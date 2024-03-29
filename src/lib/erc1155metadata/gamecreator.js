import { ethers } from "ethers";

import { blobcodexMetadataProperty } from "../chainkit/secretblobsipfs.js";
import { fileObjectFromBinary } from "../chainkit/nftstorage.js";

import { generateIconBinary } from "../openai/imageprompt.js";

import { NFTStorage } from "nft.storage";

import { conditionInput } from "../maptrie/objects.js";
import { rootLabel } from "../maptrie/logical.js";

export const defaultGameIconPrompt =
  "A stylised icon representing a turn based random dungeon crawler game";

const defaultMaxParticipants = 5;
const defaultParticipanInitialLives = 1;
export const trialSetupPropertyFilename = "trial-setup.json";

export function newGameMetadataCreator(options) {
  if (!options?.gameIconBytes) throw new Error(`gameIconBytes is required`);
  if (!options?.name) options.name = "A chaintrap game transcript";
  if (!options?.description)
    options.description =
      "A chaintrap game, find polysensus on discord for more info";
  if (!options?.mapRootLabel) options.mapRootLabel = "chaintrap-dungeon:static";

  creator = new GameMetadataCreator();
  creator.configureMetadataOptions(this.options);
  creator.configureNFTStorageOptions(this.options);
  creator.configureGameIconOptions(this.options);
  creator.configureMaptoolOptions(this.options);
}

/**
 * Support class for minting games. Minting a game is accomplished by creating a
 * game session.
 *
 * The available options for configuring interaction with the polysensus maptool
 * service. These are passed to the various prepareX methods prior to minting.
 * Minting isn't possible until all necessary options have been provided and
 * prepared.
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
 * OpenAI based game nft image generation. If a gameIconBytes is provided it is
 * used. Otherwise, the openai options must be provided and the service is used
 * to generate an image.
 * @template {{
 *  gameIconBytes?:Uint8Array,
 *  gameIconFilename?:string,
 *  openaiImagesUrl?:string,
 *  openaiApiKey?:string
 * }} GameIconOptions
 *
 * @template {{
 *  nftstorageApiKey: string,
 *  nftstorageUrl: string
 * }} NFTStorageOptions
 * @template {{
 *  map
 *  maptoolCommitUrl:string,
 *  maptoolImage:string,
 *  maptoolImageDigest:string}} MaptoolOptions
 * @template {{
 *  topology: import("../maptrie/logical.js").LogicalTopology,
 *  mapRootLabel: string
 * }} MapOptions
 */
export class GameMetadataCreator {
  /**
   * @constructor
   */
  constructor() {
    this.options = {};
    this._pendingOptions = {
      metadata: true,
      map: true,
      maptool: true,
      nftstorage: true,
      gameicon: true,
    };

    // Note: snake case for these variables as the go directly into the json metadata
    this.metadata = {};
    this.properties = {};

    this.initArgs = {};

    this.gameIcon = undefined;
    this.ipfs = undefined;
  }

  rootLabel() {
    return this.minter?.initArgs?.rootLabels[0];
  }

  allOptionsConfigured() {
    return Object.keys(this._pendingOptions).length === 0;
  }

  /**
   * prepareGameImage generates an image for the game token (if one is not
   * provided), and then prepares it for storage via nft.storage.
   * @returns
   */
  async prepareGameImage() {
    if (!this.allOptionsConfigured())
      throw new Error(
        `required configuration is missing ${Object.keys(
          this._pendingOptions
        ).join(", ")}`
      );

    if (this.options.gameIconBytes) {
      this.gameIcon = fileObjectFromBinary(
        this.options.gameIconBytes,
        this.options.nftstorageGameIconFilename ?? "game-icon.png",
        "image/png"
      );
      return;
    }

    const bytes = await generateIconBinary(this.options);
    this.gameIcon = fileObjectFromBinary(
      bytes,
      this.options.nftstorageGameIconFilename,
      "image/png"
    );
  }

  /**
   * publish the nft metadata to IPFS using nft.storage
   */
  async publishMetadata() {
    if (!this.allOptionsConfigured())
      throw new Error(
        `required configuration is missing ${Object.keys(
          this._pendingOptions
        ).join(", ")}`
      );
    if (!this.gameIcon)
      throw new Error(
        "The game image icon must be prepared before publishing the metadata"
      );

    const metadata = { ...this.metadata };
    metadata.image = this.gameIcon;
    metadata.properties = { ...this.properties };

    const client = new NFTStorage({ token: this.options.nftstorageApiKey });
    console.log("----", this.options.nftstorageApiKey);
    const { token, car } = await NFTStorage.encodeNFT(metadata);
    this.ipfs = {
      stored: await client.storeCar(car),
      token,
      car,
    };
    this.initArgs.tokenURI = this.ipfs.token.url;
    return this.initArgs.tokenURI;
  }

  /**
   * Returns the exact arguments required for arena createGame
   * @returns {{initArgs:object,object}}
   */
  createGameArgs() {
    if (!this.allOptionsConfigured())
      throw new Error(
        `required configuration is missing ${Object.keys(
          this._pendingOptions
        ).join(", ")}`
      );
    if (!this.gameIcon)
      throw new Error(
        "The game image icon must be prepared before publishing the metadata"
      );
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

  async mint(arena) {
    const tx = await arena.createGame(...this.createGameArgs());
    const r = await tx.wait();
    if (r?.status !== 1) throw new Error("createGame failed");
    return r;
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
    if (options.trialSetupCodex)
      this.properties = {
        ...this.properties,
        trialsetup: blobcodexMetadataProperty(options.trialSetupCodex, {
          ...options,
          filename: trialSetupPropertyFilename,
        }),
      };
    delete this._pendingOptions["metadata"];
  }

  /**
   * The options configuring the top level nft metadata
   * @param {NFTStorageOptions} options
   */
  configureNFTStorageOptions(options) {
    Object.assign(this.options, options);
    delete this._pendingOptions["nftstorage"];
  }

  /**
   * The options configuring the use of openai to generate the nft image (unless an image bytes is provided)
   * @param {GameIconOptions} options
   */
  configureGameIconOptions(options) {
    if (!options.gameIconBytes) {
      if (!options.openaiImagePrompt)
        throw new Error(
          "you must provide the prompt for openai image generation api OR you must instead provide the image bytes to use"
        );
      if (!options.openaiImagesUrl)
        throw new Error(
          "you must provide the url for openai image generation api OR you must instead provide the image bytes to use"
        );
      if (!options.fetch)
        throw new Error("you must provide a fetch implementation");
      if (!options.openaiApiKey)
        throw new Error("the openaiAPIKey option is required");
    }

    Object.assign(this.options, options);
    delete this._pendingOptions["gameicon"];
  }

  /**
   * The map options should be used to record how the map was generated
   * @param {MaptoolOptions} options
   */
  configureMaptoolOptions(options) {
    Object.assign(this.options, options);
    delete this._pendingOptions["maptool"];
  }

  /**
   * @param {MapOptions} options
   */
  configureMapOptions(options) {
    if (!options.trie)
      throw new Error(
        "a constructed trie, which should encode the topology, is required"
      );
    if (!options.topology) throw new Error("a map topology is required");
    if (!options.mapRootLabel)
      throw new Error(
        "a map root label is required or a map object from which to derive one"
      );
    if (!options.choiceInputTypes || options.choiceInputTypes.length == 0)
      throw new Error(
        `dungeon choice input types must be committed when the game is created`
      );

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

    // if (!options.map) throw new Error("a map is required");

    // Note: allowing for an undefined map is a concession to testability
    const vrf_inputs = options?.map?.vrf_inputs;
    if (vrf_inputs) {
      if (!vrf_inputs.proof)
        throw Error("GameMint# invalid topology, missing vrf_inputs.proof");
      if (!vrf_inputs.proof.beta)
        throw Error(
          "GameMint# invalid topology, missing vrf_inputs.proof.beta"
        );

      // TODO: public_key has moved about a bit, settle on one spot at some point.
      const public_key = vrf_inputs.proof.public_key ?? vrf_inputs.public_key;
      if (!public_key)
        throw Error(
          "GameMint# invalid topology, missing vrf_inputs.proof.public_key or vrf_inputs.public_key"
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
        map_root_label: options.mapRootLabel,
        map_root: options.trie.root,
      };
      this.properties = { ...this.properties, ...params, proofs };
    }

    // this.initArgs.registrationLimit = ethers.BigNumber.from(options.registrationLimit);
    this.initArgs.registrationLimit =
      options.registrationLimit ?? defaultMaxParticipants;
    this.initArgs.trialistArgs = {
      flags: 0,
      lives: options.initialLives ?? defaultParticipanInitialLives,
    };
    this.initArgs.rootLabels = [
      ethers.utils.formatBytes32String(options.mapRootLabel),
    ];
    this.initArgs.roots = [options.trie.root];
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

    delete this._pendingOptions["map"];
  }
}
