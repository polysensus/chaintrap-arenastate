import { namedFlags } from "./namedflags.js";

export class LocationFlags {
  static names = ["main", "inter"];
  /**
   * Calls {@link namedFlags} with the {@link LocationFlags.names}
   * @param {Object.<string, boolean>} flags
   * @returns {Uint8Array}
   */
  static bytes32(flags) {
    return namedFlags(LocationFlags.names, flags);
  }
}

export class Location {
  /**
   * Note that a join can be listed at most *once* in the an side joins list. A
   * single join cannot enter the same room in two different exits. This is why
   * we don't bother encoding the join exit index explicitly. we can always
   * search for it and the N for the search is very small.
   * @param {[number[], number[], number[], number[]]} joins
   * indexes the joins table for each SIDE. NORTH, WEST, SOUTH, EAST clockwise
   * from TOP
   * @param {Object.<string, boolean>} flags
   */
  constructor(joins, flags) {
    /** @readonly*/
    this.joins = joins;
    /** @readonly*/
    this.flags = flags;
  }
}
