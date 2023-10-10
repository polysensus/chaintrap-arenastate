import { ethers } from "ethers";

import { conditionInput } from "../maptrie/objects.js";
import { ObjectType } from "../maptrie/objecttypes.js";
import { rootLabel } from "../maptrie/logical.js";

export const defaultGameIconPrompt =
  "A stylised icon representing a turn based random dungeon crawler game";

const defaultMaxParticipants = 5;
const defaultParticipanInitialLives = 1;
export const trialSetupPropertyFilename = "trial-setup.json";

/**
 * Support class for creating the metadata for a game
 *
 * Note that for an option name fooBar, a command line option of --foo-bar via
 * the command npm package will create a compatible options instance.
 *
 * The principal metadata options for the game session nft
 *
 * @template {{
 *  name: string,
 *  description: string,
 *  tokenUrl:string,
 *  externalUrl?: string,
 * }} MetadataOptions
 *
 * Game session nft image options
 * @template {{
 *  gameIconBase64?:string,
 *  gameIconFilename?:string
 * }} GameIconOptions
 *
 * @template {{
 *  map
 *  maptoolCommitUrl?:string,
 *  maptoolImage?:string,
 *  maptoolImageDigest?:string}} MaptoolOptions
 * @template {{
 *  topology: import("../maptrie/logical.js").LogicalTopology,
 *  mapRootLabel: string
 * }} MapOptions
 */
export class GameMetadataPreparer {
  /**
   * @constructor
   */
  constructor() {
    this.options = {};
    this._pendingOptions = {
      metadata: true,
      map: true,
    };

    // Note: snake case for these variables as the go directly into the json metadata
    this.metadata = {};
    this.properties = {};
  }

  allOptionsConfigured() {
    return Object.keys(this._pendingOptions).length === 0;
  }

  prepared() {
    const metadata = { ...this.metadata };
    metadata.properties = { ...this.properties };
    return metadata;
  }

  /**
   * The options configuring the top level nft metadata
   * @param {MetadataOptions} options
   */
  configureMetadataOptions(options) {
    if (!options.name) throw new Error("A name is required");
    if (!options.description) throw new Error("A description is required");
    this.metadata.name = options.name;
    this.metadata.description = options.description;
    if (options.externalUrl) this.metadata.external_url = options.externalUrl;
    delete this._pendingOptions["metadata"];
  }

  /**
   * @param {MapOptions} options
   */
  configureMapOptions(map, trie) {
    // if (!options.map) throw new Error("a map is required");
    const mapRootLabel = rootLabel(map);

    const vrf_inputs = map?.vrf_inputs;
    if (!vrf_inputs) throw Error("Missing vrf_inputs on map");
    if (!vrf_inputs.proof)
      throw Error(
        "GameMetadataPreparer# invalid topology, missing vrf_inputs.proof"
      );
    if (!vrf_inputs.proof.beta)
      throw Error(
        "GameMetadataPreparer# invalid topology, missing vrf_inputs.proof.beta"
      );

    // TODO: public_key has moved about a bit, settle on one spot at some point.
    const public_key = vrf_inputs.proof.public_key ?? vrf_inputs.public_key;
    if (!public_key)
      throw Error(
        "GameMetadataPreparer# invalid topology, missing vrf_inputs.proof.public_key or vrf_inputs.public_key"
      );

    // The map generation params contribute to the alpha but do not compromise
    // it if revealed. And they are a good indication of map characteristics.
    let params = vrf_inputs.alpha.split(":");
    params = Object.fromEntries(
      params[params.length - 1].split(",").map((params) => params.split("="))
    );
    const proofs = {
      beta: vrf_inputs.proof.beta,
      public_key: vrf_inputs.proof.public_key,
      map_root_label: mapRootLabel,
      map_root: trie.root,
    };
    this.properties = { ...this.properties, ...params, proofs };
    delete this._pendingOptions["map"];
  }
}

// chaintrapGameDefaults provides the defaults for configureInitArgs
export const chaintrapGameDefaults = {
  choiceInputTypes: [ObjectType.LocationChoices],
  transitionTypes: [
    ObjectType.Link2,
    ObjectType.Finish,
    ObjectType.FatalChestTrap,
    ObjectType.ChestTreatGainLife,
  ],
  victoryTransitionTypes: [ObjectType.Finish],
  haltParticipantTransitionTypes: [ObjectType.FatalChestTrap],
  livesIncrement: [ObjectType.ChestTreatGainLife],
  livesDecrement: [ObjectType.FatalChestTrap],
};

export class GameInitArgsPreparer {
  constructor() {
    this.options = {
      networkEIP1559: false,
    };
    this.initArgs = {};
  }

  rootLabel() {
    return this.initArgs?.rootLabels[0];
  }
  /**
   * Returns the exact arguments required for arena createGame
   * @returns {[object,object]}
   */
  createGameArgs() {
    if (!Object.keys(this.initArgs).length) throw new Error("not configured");
    if (!this.initArgs.tokenURI)
      throw new Error(
        "The game metadata must be published to IPFS before minting the game token"
      );
    return [
      this.initArgs,
      {
        type: this.options.networkEIP1559 ? 2 : 0,
      },
    ];
  }

  configureInitArgs(metadata, options) {
    if (
      !metadata?.properties?.proofs?.map_root ||
      !metadata?.properties?.proofs?.map_root_label
    )
      throw new Error("metadata.proofs.map_ properties not configured");
    const tokenURI = options.tokenURI;
    if (!tokenURI) throw new Error("options.tokenURI is required");

    if (!options.choiceInputTypes || options.choiceInputTypes.length == 0)
      throw new Error(
        `dungeon choice input types must be committed when the game is created`
      );

    this.initArgs.tokenURI = tokenURI;

    const transitionTypes = {};
    for (const ty of options?.transitionTypes ?? []) transitionTypes[ty] = true;
    if (Object.keys(transitionTypes).length < 2)
      throw new Error(
        `at least two transition types are required for a completable game`
      );
    if ((options.victoryTransitionTypes ?? []).length < 1)
      throw new Error(
        `at least one victory transition types is required for a completable game`
      );
    for (const ty of options.victoryTransitionTypes)
      if (!(ty in transitionTypes))
        throw new Error(
          `all victory transition types must also be listed in transitionTypes`
        );

    for (const ty of options.haltParticipantTransitionTypes ?? [])
      if (!(ty in transitionTypes))
        throw new Error(
          `all halting transition types must also be listed in transitionTypes`
        );

    // this.initArgs.registrationLimit = ethers.BigNumber.from(options.registrationLimit);
    this.initArgs.registrationLimit =
      options.registrationLimit ?? defaultMaxParticipants;
    this.initArgs.trialistArgs = {
      flags: 0,
      lives: options.initialLives ?? defaultParticipanInitialLives,
    };
    this.initArgs.rootLabels = [
      ethers.utils.formatBytes32String(
        metadata.properties.proofs.map_root_label
      ),
    ];
    this.initArgs.roots = [metadata.properties.proofs.map_root];
    this.initArgs.choiceInputTypes =
      options.choiceInputTypes.map(conditionInput);
    this.initArgs.transitionTypes = options.transitionTypes.map(conditionInput);
    this.initArgs.victoryTransitionTypes =
      options.victoryTransitionTypes.map(conditionInput);
    this.initArgs.haltParticipantTransitionTypes = (
      options.haltParticipantTransitionTypes ?? []
    ).map(conditionInput);
    this.initArgs.livesIncrement = (options.livesIncrement ?? []).map(
      conditionInput
    );
    this.initArgs.livesDecrement = (options.livesDecrement ?? []).map(
      conditionInput
    );
  }
}
