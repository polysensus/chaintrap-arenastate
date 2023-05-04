import { ethers } from "ethers";

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { LinkLeaf } from "./leaves.js";

import { Location } from "./location.js";
import { Join } from "./join.js";

export class LogicalTopology {
  /**
   * proof that "an entry exists in joins which laves location i via side m, exit n, and enters location j, via side r, exit s"
   */

  constructor() {
    /**
     * Each this.joins[i].joins is a pair of indices into this.locations
     * @type {Join[]}
     * @readonly
     */
    this.joins = [];

    /**
     * Each this.location[i].joins is a pair of indices into this.joins
     * @type {Location[]}
     * @readonly
     */
    this.locations = [];
  }

  buildMerkleTrie() {
    return StandardMerkleTree.of([...this.links()], LinkLeaf.ABI);
  }

  *links() {
    for (let i = 0; i < this.joins.length; i++) yield this.link(i);
  }

  /**
   * Return the link representation of the join as
   * [[loc, side, access], [loc, side, access]]
   * @param {number} join
   * @returns {[[number, number, number], [number, number, number]]}
   */
  link(join) {
    const link = [];
    link.push(this.whichAccessForJoin(join, 0));
    link.push(this.whichAccessForJoin(join, 1));
    return link;
  }

  /**
   * Return the access (exit) index for the entry in the location side joins
   * list matching the argument join or undefined if none match.
   * @param {number} join index into joins
   * @param {number} loc index into locations
   * @param {0|1|2|3} side index into location sides
   * @return {number|undefined} the access index (also known as the exit index)
   */
  accessIndex(join, loc, side) {
    // The access index is the index in the location side whose value matches i
    const sideAccesses = this.locations[loc].joins[side];
    for (let i = 0; i < sideAccesses.length; i++) {
      if (sideAccesses[i] === join) return i;
    }
    return undefined;
  }

  /**
   *
   * @param {number} join joins entry index
   * @param {0|1} which side of the join that is desired
   * @returns {[number, number, number]}
   */
  whichAccessForJoin(join, which) {
    if (which !== 0 && which !== 1)
      throw new Error(`which must be 0 or 1, not ${which}`);
    if (join >= this.joins.length)
      throw new Error(
        `join index ${join} is out of range. last is ${this.joins.length - 1}`
      );

    const [loc, side] = [
      this.joins[join].joins[which],
      this.joins[join].sides[which],
    ];

    // The access index is the index in the location side whose value matches i
    const access = this.accessIndex(join, loc, side);

    if (typeof access === "undefined")
      throw Error(
        `join ${join} does not have a corresponding access entry on location ${loc}`
      );

    return [loc, side, access];
  }

  /**
   * a list of objects describing the geometry of joins between pairs of locations
   * @template {{joins: [number, number], join_sides:[number, number]}|{joins: [number, number], sides:[number, number]}} JoinLike
   * @param {JoinLike[]} joins - aka corridor
   */
  extendJoins(joins) {
    for (const join of joins) {
      const sides = join.sides ?? join.join_sides;
      if (!sides)
        throw new Error(
          "badly structured join object, has neither sides nor join_sides"
        );
      this.joins.push(new Join([...join.joins], [...sides]));
    }
  }

  /**
   * A list of objects describing the geometry of locations
   * @template {{joins:[number[], number[], number[], number[]], flags:Object.<string, boolean>}} LocationLike
   * @template {{corridors:[number[], number[], number[], number[]], inter:boolean, main:boolean}} RoomLike
   * @param {LocationLike[]|RoomLike[]} locations
   */
  extendLocations(locations) {
    for (const loc of locations) {
      if (loc.corridors) {
        this.locations.push(
          new Location(structuredClone(loc.corridors), {
            inter: loc.inter,
            main: loc.main,
          })
        );
        continue;
      }
      if (!loc.joins) throw new Error("badly structured location object");
      this.locations.push(
        new Location(structuredClone(loc.joins), { ...loc.flags })
      );
    }
  }
}
