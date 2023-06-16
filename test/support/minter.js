import ethers from "ethers";
import fetch from "node-fetch";
import { readBinaryData, readJsonData } from "./data.js";

import { getMap } from "../../src/lib/map/collection.js";
import { LogicalTopology } from "../../src/lib/maptrie/logical.js";
import { GameMint } from "../../src/lib/mint/gamemint.js";

/**
 * This class provides a mint method which is compatible with hardhat /
 * loadFixture It can be used to efficiently ensure a test case has a freshly
 * created game to work with.
 */
export class Minter {
  constructor(arena, options) {
    this.arena = arena;
    this.options = { ...options };
    if (!options.gameIconBytes)
      this.options.gameIconBytes = readBinaryData("gameicons/game-ico-1.png");
    if (!options.name) this.options.name = "minter.js:Minter# test game";
    if (!options.description)
      this.options.description = "minter.js:Minter# test game";
    if (!options.fetch) this.options.fetch = fetch;
    if (!options.mapRootLabel)
      this.options.mapRootLabel = "chaintrap-dungeon:static";

    this.minter = new GameMint();
    this.minter.configureMetadataOptions(this.options);
    this.minter.configureNFTStorageOptions(this.options);
    this.minter.configureGameIconOptions(this.options);
    this.minter.configureMaptoolOptions(this.options);

    this.collection = undefined;
    this.map = undefined;
    this.topology = undefined;
    this.trie = undefined;
  }

  /**
   *
   * @param {{collectionName?}} options
   */
  loadMap(options) {
    this.collection = readJsonData(
      options?.collectionName ?? "maps/map02.json"
    );
    this.map = getMap(this.collection).map;
    this.topology = LogicalTopology.fromCollectionJSON(this.collection);
    this.trie = this.topology.encodeTrie();
  }

  async mint(options) {
    this.map = options?.map;
    this.topology = options?.topology;
    this.trie = options?.trie;

    if (!(this.topology && this.trie))
      throw new Error(
        `topology and trie are required to mint, consider using loadMap`
      );

    this.minter.configureMapOptions({
      ...this.options,
      topology: this.topology,
      map: this.map,
      trie: this.trie,
    });

    if (this.map && !options.noMETADATA) {
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
