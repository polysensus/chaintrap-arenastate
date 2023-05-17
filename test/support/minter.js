import fetch from "node-fetch";
import { readBinaryData, readJsonData } from "./data.js";

import { LogicalTopology } from "../../src/lib/maptrie/logical.js";
import { GameMint } from "../../src/lib/mint/gamemint.js";

/**
 * This class provides a mint method which is compatible with hardhat /
 * loadFixture It can be used to efficiently ensure a test case has a freshly
 * created game to work with.
 */
export class MinterFixture {
  constructor(arena, options) {
    this.arena = arena;
    this.options = { ...options };
    if (!options.gameIconBytes)
      this.options.gameIconBytes = readBinaryData("gameicons/game-ico-1.png");
    if (!options.name) this.options.name = "minter.js:MinterFixture# test game";
    if (!options.description)
      this.options.description = "minter.js:MinterFixture# test game";
    if (!options.fetch) this.options.fetch = fetch;
    if (!options.mapRootLabel)
      this.options.mapRootLabel = "chaintrap-dungeon:static";

    this.collection = readJsonData("maps/map02.json");
    this.topology = LogicalTopology.fromCollectionJSON(this.collection);
    this.trie = this.topology.encodeTrie();
    this.minter = new GameMint();
    this.minter.configureMetadataOptions(this.options);
    this.minter.configureNFTStorageOptions(this.options);
    this.minter.configureGameIconOptions(this.options);
    this.minter.configureMaptoolOptions(this.options);
    this.minter.configureMapOptions({
      ...this.options,
      topology: this.topology,
      trie: this.trie,
    });
  }

  async mint() {
    await this.minter.prepareGameImage();
    await this.minter.publishMetadata();
    const r = await this.minter.mint(this.arena);
    return r;
  }
}
