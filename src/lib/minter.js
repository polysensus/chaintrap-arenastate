import { GameMetadataCreator } from "./erc1155metadata/gamecreator.js";

export class Minter {
  /**
   *
   * @param {*} arena
   * @param {any} serviceOptions options for access to various services, they tend to be set once
   */
  constructor(arena, serviceOptions) {
    this.reset();
    this.arena = arena;
    this.serviceOptions = { ...serviceOptions };
  }

  reset() {
    this.arena = undefined;
    this.serviceOptions = undefined;
    this.minter = undefined;
  }

  applyOptions(options) {
    this.options = { ...this.serviceOptions, ...options };
    if (!options?.gameIconBytes) throw new Error(`gameIconBytes is required`);
    if (!options?.name) this.options.name = "A chaintrap game transcript";
    if (!options?.description)
      this.options.description =
        "A chaintrap game, find polysensus on discord for more info";
    if (!options?.fetch) throw new Error("a fetch implementation is required");
    if (!options?.mapRootLabel)
      this.options.mapRootLabel = "chaintrap-dungeon:static";

    this.minter = new GameMetadataCreator();
    this.minter.configureMetadataOptions(this.options);
    this.minter.configureNFTStorageOptions(this.options);
    this.minter.configureGameIconOptions(this.options);
    this.minter.configureMaptoolOptions(this.options);
  }

  async mint(options) {
    if (!this.options) throw new Error(`applyOptions before minting`);

    const { topology, map, trie } = options;
    if (!(topology && trie))
      throw new Error(`topology, map and trie are required options for mint`);

    this.minter.configureMapOptions({
      ...this.options,
      topology,
      map,
      trie,
    });

    if (map && !this.options.noMETADATA) {
      await this.minter.prepareGameImage();
      await this.minter.publishMetadata();
    } else {
      this.minter.gameIcon = "image not configured";
      this.minter.initArgs.tokenURI = "token URI not configured";
    }
    const r = await this.minter.mint(this.arena);
    return r;
  }
}
