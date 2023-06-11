import { ethers } from "ethers";
import * as msgpack from "@msgpack/msgpack";
import { getMap } from "./map/collection.js";
import { SceneCatalog } from "./map/scenecatalog.js";
import { LogicalTopology } from "./maptrie/logical.js";
import {
  LeafObject,
  ObjectCodec,
  leafHash,
} from "./maptrie/objects.js";

import {
  ObjectType
} from "./maptrie/objecttypes.js";
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

    this.choiceAccess = {};

    for (
      let location = 0;
      location < this.topology.locations.length;
      location++
    ) {
      const scene = this.scenes.scene(location);
      scene.exitChoices = [[], [], [], []];
      for (let side = 0; side < scene.exitChoices.length; side++) {
        for (const link of this.topology.locationSideLinks(location, side)) {
          const choice = leafHash(
            ObjectCodec.prepare(
              new LeafObject({ type: ObjectType.Link, leaf: link })
            )
          );
          scene.exitChoices[side].push(choice);
          this.choiceAccess[choice] = link.b;
        }

        if (scene.exitChoices[side].length != scene.corridors[side].length)
          throw new Error(
            `number of location choices inconsistent with the scene side corridors`
          );
      }
    }
  }

  /**
   * @param {number} location
   * @returns {{data, choices}}
   */
  scene(location) {
    const scene = this.scenes.scene(location);
    const data = msgpack.encode(scene);
    const choices = [
      ...scene.exitChoices[0],
      ...scene.exitChoices[1],
      ...scene.exitChoices[2],
      ...scene.exitChoices[3],
    ];

    return { data, choices };
  }

  /**
   * @param {[...number]} starts
   * @returns {{choices, data}}
   */
  createStartGameArgs(starts) {
    // one of each for each trialist.
    const choices = [];
    const data = [];

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
