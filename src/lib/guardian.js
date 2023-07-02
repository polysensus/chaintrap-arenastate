import { getMap } from "./map/collection.js";
import { rootLabel, LogicalTopology } from "./maptrie/logical.js";
import { ArenaEvent } from "./arenaevent.js";
import { EventParser } from "./chainkit/eventparser.js";
import { Minter } from "./minter.js";
import { TransactRequest } from "./chainkit/transactor.js";

export class Guardian {
  constructor(eventParser, options) {
    this.init(eventParser, options);
  }

  init(eventParser, options) {
    if (options) this.initialOptions = { ...options };

    if (eventParser) this.eventParser = eventParser;
    this.arena = this.eventParser.contract;

    this.minter = new Minter(this.arena, this.initialOptions);
    this.lastMintedGID = undefined;
    this._preparingDungeon = false;
    this._dungeonPrepared = false;
    this._lastMinted = undefined;

    this.collection = undefined;
    this.map = undefined;
    this.topology = undefined;
    this.trie = undefined;
    this._mapLoaded = false;
    this._topologyCommitted = false;
  }

  /**
   * @param {any} collection
   * @param {{mapName?}} options
   */
  loadMap(collection, options) {
    this.collection = collection;
    this.map = getMap(this.collection, options?.mapName).map;
    this.topology = LogicalTopology.fromCollectionJSON(this.collection);
  }

  prepareDungeon(collection, options) {
    this._dungeonPrepared = false;
    this.loadMap(collection, options);
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

    options = { ...options };
    if (!options.mapRootLabel)
      options.mapRootLabel = rootLabel(this.map, options.mapName);

    this.minter.applyOptions({ ...options });
    const r = await this.minter.mint({
      topology: this.topology,
      map: this.map,
      trie: this.trie,
    });
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

    this._lastMinted = {
      gid: created.gid,
      creator: created.parsedLog.args.creator,
      registrationLimit: created.parsedLog.args.registrationLimit,
    };
    return result;
  }
  lastMinted() {
    return { ...this._lastMinted };
  }
}
