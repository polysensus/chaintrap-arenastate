// @ts-check
export class LocationGeometry {
  /**
   *
   * @param {number} l
   * @param {number} w
   * @param {number} x
   * @param {number} y
   */
  constructor(l, w, x, y) {
    /** @readonly */
    this.l = l;
    /** @readonly */
    this.w = w;
    /**
     * @type {number}
     * @readonly */
    this.x = x;
    /**
     * @type {number}
     * @readonly */
    this.y = y;
  }
}

// @typedef {[number, number]}  PointLike

export class JoinGeometry {
  /**
   * @param {[[number, number], [number, number]] | [[number, number], [number, number], [number, number]] | undefined} points
   */
  constructor(points) {
    /** @readonly*/
    this.points = structuredClone(points);
  }
}

/**
 * This class should be used in association with a LogicalTopology. Such that
 * each of the topology.joins and topology.locations is 1:1 associative with the
 * equivalent entries in this instance.
 */
export class Geometry {
  constructor() {
    /**
     * Each this.joins[i].joins is a list of points. For straight corridors there will be 2 points. L corridors will have three.
     * @type {JoinGeometry[]}
     * @readonly
     */
    this.joins = [];

    /**
     * Each this.location[i] defines the area of the location. Note that
     * intersections have zero width and the x, y marks the center of the
     * intersection.
     * @type {LocationGeometry[]}
     * @readonly
     */
    this.locations = [];
  }

  /**
   * A list of objects describing the geometry of locations
   * @template {{l:number, w:number, x:number, y: number}} LocationGeometryLike
   * @param {LocationGeometryLike[]} locations
   */
  extendLocations(locations) {
    for (const loc of locations) {
      this.locations.push(new LocationGeometry(loc.l, loc.w, loc.x, loc.y));
    }
  }

  /**
   * a list of objects describing the geometry of joins between pairs of locations
   * @template {{points:[[number, number], [number, number]] | [[number, number], [number, number], [number, number]]}} JoinGeometryLike
   * @param {JoinGeometryLike[]} joins - aka corridor
   */
  extendJoins(joins) {
    for (const join of joins) {
      this.joins.push(new JoinGeometry(join.points));
    }
  }
}
