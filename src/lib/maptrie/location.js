import { namedFlags } from "./namedflags.js";

export class LocationFlags {
  /*
    california: as in "hotel california" flags the null link. we prove invalid moves by proving a link to hotel california.
    main: the location is a normal room
    inter: the location is an intersection
   */
  static names = ["california", "main", "inter"];
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
   * Note that a join can be listed at most *once* in the any single side joins
   * list. Because a single join cannot enter the same room in two different
   * exits. This is why we don't bother encoding the join exit index explicitly.
   * we can always search for it and the N for the search is very small.
   * @param {[number[], number[], number[], number[]]} sides
   * indexes the joins table for each SIDE. NORTH, WEST, SOUTH, EAST clockwise
   * from TOP
   * @param {Object.<string, boolean>} flags
   */
  constructor(sides, flags) {
    /** @readonly*/
    this.sides = sides;
    /** @readonly*/
    this.flags = flags;
  }
}
