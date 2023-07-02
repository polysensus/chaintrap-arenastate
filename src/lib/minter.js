import ethers from "ethers";
import fetch from "node-fetch";
import { readBinaryData, readJsonData } from "./data.js";

import { GameMint } from "./mint/gamemint.js";

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
    if (!options?.gameIconBytes)
      this.options.gameIconBytes = readBinaryData("gameicons/game-ico-1.png");
    if (!options?.name) this.options.name = "minter.js:Minter# test game";
    if (!options?.description)
      this.options.description = "minter.js:Minter# test game";
    if (!options?.fetch) this.options.fetch = fetch;
    if (!options?.mapRootLabel)
      this.options.mapRootLabel = "chaintrap-dungeon:static";

    this.minter = new GameMint();
    this.minter.configureMetadataOptions(this.options);
    this.minter.configureNFTStorageOptions(this.options);
    this.minter.configureGameIconOptions(this.options);
    this.minter.configureMaptoolOptions(this.options);
  }

  async mint(options) {

    const {topology, map, trie} = options;
    if (!(topology && trie))
      throw new Error(`topology, map and trie are required options for mint`);

    this.minter.configureMapOptions({
      ...this.options, topology, map, trie });

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
