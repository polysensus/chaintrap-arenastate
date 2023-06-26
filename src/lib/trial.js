import { ethers } from "ethers";
import * as msgpack from "@msgpack/msgpack";
import { getMap } from "./map/collection.js";
import { SceneCatalog } from "./map/scenecatalog.js";
import { LogicalTopology } from "./maptrie/logical.js";
import { LeafObject, ObjectCodec, leafHash } from "./maptrie/objects.js";

import { ObjectType } from "./maptrie/objecttypes.js";
/**
 * A realm holds all of the physical artifacts associated with the game and the
 * merkle tries used to prove action outcomes and so on.
 * @typedef {import("./maptrie/logical.js").LocationTopology} LocationTopology
 * @typedef {import("./map/scenecatalog.js").SceneCatalog} SceneCatalog
 * @typedef {import("@openzeppelin/merkle-tree").StandardMerkleTree} StandardMerkleTree
 */
export class Trial {
  static fromCollectionJSON(maps, options) {
    const { map, name } = getMap(maps, options?.mapName);
    options = { ...options, mapName: name };
    return new Trial(map, options);
  }

  /**
   * @constructor
   * @param {object} map
   */
  constructor(map, options) {
    this.options = { ...options };
    this.map = map;
    this.scenes = new SceneCatalog();
    this.scenes.load(map);

    this.topology = new LogicalTopology();
    this.topology.extendJoins(map.model.corridors); // rooms 0,1 sides EAST, WEST
    this.topology.extendLocations(map.model.rooms);
    this.staticTrie = this.topology.encodeTrie();
    this.arena = undefined;
    this.gid = undefined;
  }

  /**
   * @param {number} location
   * @returns {{data, choices}}
   */
  scene(location) {
    throw new Error("nyi");
  }

  /**
   * @param {[...number]} starts
   * @returns {{choices, data}}
   */
  createStartGameArgs(starts) {
    // one of each for each trialist.
    const choices = [];
    const data = [];
    throw new Error("nyi");

    for (let itrialist = 0; itrialist < starts.length; itrialist++) {
      const scene = this.scene(starts[itrialist]);
      data.push(scene.data);
      choices.push(scene.choices);
    }

    return { choices, data };
  }

  /**
   *
   * @param {ethers.AddressLike} trialist
   * @param {ethers.DataHexString} choice
   * @returns
   */
  createResolveOutcomeArgs(trialist, choice) {
    const iProof = this.staticTrie.hashLookup[choice];
    if (!iProof) {
      throw new Error(`choice ${choice} not found in trie`);
    }
    // Note: If the choice doesn't match the choice recorded by the player the
    // proof will be invalid. And the player can't set a choice that hasn't been
    // made available by the guardian. So '3':Accepted is always appropriate and safe here
    const { choices, data } = this.scene(this.choiceAccess[choice].location);
    return {
      participant: trialist,
      outcome: 3,
      data,
      proof: this.staticTrie.getProof(iProof),
      choices,
    };
  }
}
