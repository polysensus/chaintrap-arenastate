import ethers from "ethers";
import fetch from "node-fetch";
import { readBinaryData, readJsonData } from "./data.js";

import { getMap } from "./map/collection.js";
import { LogicalTopology } from "./maptrie/logical.js";
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
    this.collection = undefined;
    this.map = undefined;
    this.topology = undefined;
    this.trie = undefined;
    this._mapLoaded = false;
    this._topologyCommitted = false;
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

  /**
   * @param {any} collection
   * @param {{mapName?}} options
   */
  loadMap(collection, options) {
    this.collection = collection;
    this.map = getMap(this.collection, options?.mapName).map;
    this.topology = LogicalTopology.fromCollectionJSON(this.collection);
    this._mapLoaded = true;
  }

  commitTopology() {
    this.trie = this.topology.commit();
    this._topologyCommitted = true;
  }

  async mint() {
    if (!this._mapLoaded) throw new Error(`map must be loaded before minting`);
    if (!this._topologyCommitted)
      throw new Error(`topology must be committed before minting`);

    this.minter.configureMapOptions({
      ...this.options,
      topology: this.topology,
      map: this.map,
      trie: this.trie,
    });

    if (this.map && !this.options.noMETADATA) {
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
