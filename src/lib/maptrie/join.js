export class Join {
  // location,
  /**
   * @param {[number, number]} joins pair of location indices in a LogicalTopology, representing a connection (join) of those two locations.
   * @param {[number, number]} sides a side index, associated with each location in joins. The join for location joins[0], is attached to the location on sides[0].
   * @param {Object.<string, boolean>} flags
   */
  constructor(joins, sides, flags) {
    /** @readonly */
    this.joins = [...joins];
    /** @readonly */
    this.sides = [...sides];
    /** @readonly */
    this.flags = { ...flags };
  }
}
