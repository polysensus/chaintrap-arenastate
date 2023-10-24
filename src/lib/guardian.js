import { Furniture } from "./map/furniture.js";
import { rootLabel, LogicalTopology } from "./maptrie/logical.js";
import { TransactRequest } from "./chainkit/transactor.js";
import { Journal } from "./journal.js";
import { Trial } from "./trial.js";
import { ObjectType } from "./maptrie/objecttypes.js";

import { chaintrapGameDefaults } from "./erc1155metadata/metadataprepare.js";
import { prepareTrialMetadata } from "./erc1155metadata/metadataprepare.js";
import { prepareTrialInitArgs } from "./erc1155metadata/metadataprepare.js";
import { publishTrialMetadata } from "./erc1155metadata/metadataprepare.js";

export const FINISH_EXIT_NAME = "finish_exit";

// Everything we put in the secretblobs blobcodex on the game nft metadata.
export const CODEX_MAP_INDEX = "map";
export const CODEX_FURNITURE_INDEX = "furniture";
export const CODEX_SVG_INDEX = "svg";
export const CODEX_COMMITTED_INDEX = "committed";
export const CODEX_INDEXED_ITEMS = [
  CODEX_MAP_INDEX,
  CODEX_FURNITURE_INDEX,
  CODEX_COMMITTED_INDEX,
  CODEX_SVG_INDEX,
];

export class Guardian {
  constructor(eventParser, options) {
    this.init(eventParser, options);
  }

  init(eventParser, options) {
    if (options) this.initialOptions = { ...options };
    this.setupOptions = undefined;

    if (eventParser) this.eventParser = eventParser;
    this.arena = this.eventParser?.contract;

    if (this.eventParser) this.journal = new Journal(this.eventParser, options);

    this.trials = {};

    this.lastMintedGID = undefined;
    this._preparingDungeon = false;
    this._dungeonPrepared = false;

    this.topology = undefined;
    this.trie = undefined;
    this._mapLoaded = false;
    this._topologyCommitted = false;
  }

  setupTrial(codex, options = {}) {
    this.setupOptions = { ...this.initialOptions, ...options };
    this.trialSetupCodex = codex; // The map data, AES encrypted via a PBKDF

    // the map and furniture are added as well known singletons in the trial setup codices.
    const map = JSON.parse(
      codex.getIndexedItem(CODEX_MAP_INDEX, this.setupOptions)
    );
    const furnishings = JSON.parse(
      codex.getIndexedItem(CODEX_FURNITURE_INDEX, this.setupOptions)
    );
    this.prepareDungeon(map);
    this.furnishDungeon(furnishings);
    this.finalizeDungeon();
  }

  prepareDungeon(map) {
    this._dungeonPrepared = false;
    this.map = map;
    this.topology = LogicalTopology.fromMapJSON(map);
    this._mapLoaded = true;
    this._preparingDungeon = true;
  }

  preparedDungeon() {
    if (!this._dungeonPrepared) throw new Error(`dungeon not prepared`);
    return {
      map: this.map,
      topology: this.topology,
      trie: this.trie,
    };
  }

  furnishDungeon(furnishings) {
    this.topology.placeFurniture(new Furniture(furnishings));
  }

  finalizeDungeon() {
    if (!this._preparingDungeon) throw new Error(`nothing to finalize`);
    this._preparingDungeon = false; // if the commit fails, you need to start all over
    this.trie = this.topology.commit();
    this._topologyCommitted = true;
    this._dungeonPrepared = true;
  }

  async mintGame(options) {
    if (!this._mapLoaded) throw new Error(`map must be loaded before minting`);
    if (!this._topologyCommitted)
      throw new Error(`topology must be committed before minting`);
    if (!this._dungeonPrepared) throw new Error("dungeon not prepared");

    // Note that without a codex the game is not playable, its absence is
    // permited as a concession to testing.
    options = { trialSetupCodex: this.trialSetupCodex, ...this.setupOptions, ...options };

    if (!options.gameIconBytes)
      throw new Error("gameIconBytes is a required option");

    if (!options.mapRootLabel) options.mapRootLabel = rootLabel(this.map);

    const metadata = prepareTrialMetadata(
      this.map, this.trie, {name:options.name, description:options.description, ...options}
      );

    let tokenURI = 'meta-data-not-published';

    if (!options.noMetadataPublish) { // testing concesion
      const tokenURI = (await publishTrialMetadata(
        metadata, {
          ...options,
          imageBytes: options.gameIconBytes, imageContentType:"image/png",
          imageFilename: options.nftstorageGameIconFilename,
        }))?.token.url;
    }
    console.log(`tokenURI: ${tokenURI}`);

    const args = prepareTrialInitArgs(metadata.properties, {
      ...chaintrapGameDefaults, registrationLimit: options.maxParticipants, tokenURI,
      networkEIP1559: options?.networkEIP1559
    });

    return await this.createGame(...args);
  }

  async createGame(initArgs, transactOpts) {
    const tx = await this.arena.createGame(initArgs, transactOpts);
    const r = await tx.wait();
    if (r?.status !== 1) throw new Error("createGame failed");

    const collector = new TransactRequest(this.eventParser);
    const result = collector
      .requireLogs(
        "TransferSingle(address,address,address,uint256,uint256)",
        // Only sets one root
        "TranscriptMerkleRootSet(uint256,bytes32,bytes32)",
        "TranscriptCreated(uint256,address,uint256)"
      )
      .acceptLogs("URI(string,uint256)")
      .collect(r);

    const created = result.eventByName("TranscriptCreated");

    return {
      gid: created.gid,
      creator: created.parsedLog.args.creator,
      registrationLimit: created.parsedLog.args.registrationLimit,
      result,
    };
  }

  /** start listening to the dungeon just prepared by the guardian */
  async preparedStartListening(gid, options) {
    return this.startListening2(gid, this.preparedDungeon(), options);
  }

  async startListening(gid, options) {
    return this.startListening2(gid, this.preparedDungeon(), options);
  }

  /**
   * @param {ethers.BigNumber} gid 
   * @param {{map,topology,trie}} prepared 
   * @param {*} options 
   * @returns 
   */
  async startListening2(gid, prepared, options) {
    const staticRootLabel = (await this.journal.findStaticRoot(gid)).rootLabel;
    this.trials[gid.toHexString()] = new Trial(
      gid,
      staticRootLabel,
      prepared
    );
    return await this.journal.startListening([gid], options);
  }


  async openTranscript(gid) {
    const staticRootLabel = (await this.journal.findStaticRoot(gid)).rootLabel;
    this.journal.openTranscript(gid, staticRootLabel);
    this.trials[gid.toHexString()] = new Trial(
      gid,
      staticRootLabel,
      this.preparedDungeon()
    );
  }

  async startGame(gid, ...starts) {
    const gidHex = gid.toHexString();
    const trial = this.trials[gidHex];
    if (!trial)
      throw new Error(`transcript for gid ${gidHex} has not been opened`);

    const startArgs = trial.createStartGameArgs(starts);
    const request = new TransactRequest(this.eventParser);
    request
      .method(this.arena.startTranscript, gid, startArgs)
      .requireLogs(
        "TranscriptStarted(uint256)",
        "TranscriptEntryChoices(uint256,address,uint256,(uint256,bytes32[][]),bytes)"
      );

    const result = await request.transact();
    return result;
  }

  async resolvePending(gid) {
    const gidHex = gid.toHexString();
    const trial = this.trials[gidHex];
    if (!trial)
      throw new Error(`transcript for gid ${gidHex} has not been opened`);

    const resolved = [];

    for (const trialist of this.journal.pendingOutcomes(gid)) {
      // const delta = trialist.delta({collect:true});
      const locationId = parseInt(trialist.state.location[0], 16);
      const choice = trialist.state.choices[trialist.state.inputChoice];
      const resolveArgs = trial.createResolveOutcomeArgs(
        trialist.state.address,
        locationId,
        choice
      );

      const request = new TransactRequest(this.eventParser);
      request
        .method(this.arena.transcriptEntryResolve, gid, resolveArgs)
        .requireLogs(
          "TranscriptEntryOutcome(uint256,address,uint256,address,bytes32,uint8,bytes)"
        );

      switch (resolveArgs.proof.transitionType) {
        case ObjectType.Finish: {
          request.requireLogs(
            "TransferSingle(address,address,address,uint256,uint256)",
            "TranscriptCompleted(uint256)"
          );
          break;
        }
        case ObjectType.Link2: {
          request.requireLogs(
            "TranscriptEntryChoices(uint256,address,uint256,(uint256,bytes32[][]),bytes)"
          );
          break;
        }
        case ObjectType.FatalChestTrap: {
          // if the player gained a life, then they can survive the fatal trap
          request.acceptLogs(
            "TranscriptParticipantHalted(uint256,address,uint256)"
          );
          request.requireLogs(
            "TranscriptParticipantLivesLost(uint256,address,uint256,uint256)"
          );
          break;
        }
        case ObjectType.ChestTreatGainLife: {
          request.requireLogs(
            "TranscriptParticipantLivesAdded(uint256,address,uint256,uint256)"
          );
          break;
        }
        default:
          throw new Error(`un-expected transitionType`);
      }

      await request.transact();
      resolved.push(trialist.state.address);
    }
    return resolved;
  }
}
