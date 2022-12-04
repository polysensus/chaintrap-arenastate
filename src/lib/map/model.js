import {
  sourceCorridorBounds,
  sourceRoomBounds,
  sourceRoomAverageBounds,
  roomSideMinMax,
} from "./utils.js";

export class MapModel {
  construct(z) {
    this._resetMap();

    this.zBase = z?.base || 10;

    // Note larger z over draws lower z. Its painters algorithm, last thing
    // painted over writes everything else
    this.zExit = z?.exit || this.zBase + 50;
    this.zRoom = z?.room || this.zBase + 40;
    this.zCorridor = z?.corridor || this.zBase + 30;

    // minRoomDimension is used to pick a consistent diameter for all markers and hit zones.
    // but it is subject to a minimum.
    this.minRoomDimension = undefined;
  }

  _resetMap() {
    this.mapsource = undefined;
    // flat list of exits, it is always even length as exits always come in
    // pairs, one egress in each ajoined room/corridor. But we only draw and
    // bind the exits inside the rooms

    // map elements in map format
    this.map = {
      exits: [],
      rooms: [],
      corridors: [],
    };
    this.exits = [];
    this.rooms = [];
    this.corridors = [];
    this.scenes = []; // one per room
  }

  /**
   * Return a scene for the room
   * @param {number} iroom
   */
  locationScene(iroom) {
    return this.scenes[iroom];
  }

  /**
   * @param {number} iroom
   */
  _locationScene(iroom) {
    if (iroom >= this.map.rooms.length) {
      throw Error(`room ${iroom} out of range. have ${this.map.rooms.length}`);
    }

    const sceneCorridors = [[], [], [], []];

    const r = this.map.rooms[iroom];

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < r.corridors[i].length; j++) {
        const rc = r.corridors[i][j];
        const roomside = i;
        // get the point matching the roomside

        let exitpoint;
        if (this.map.corridors[rc].join_sides[0] === roomside) {
          exitpoint = this.map.corridors[rc].points[0];
        } else if (this.map.corridors[rc].join_sides[1] === roomside) {
          exitpoint =
            this.map.corridors[rc].points[
              this.map.corridors[rc].points.length - 1
            ];
        } else {
          console.log(
            `room ${iroom}, side ${roomside}, corridor ${rc} not correctly connected`
          );
          console.log(
            `corridor.joins: ${this.map.corridors[rc].joins[0]} ${this.map.corridors[rc].joins[1]}`
          );
          console.log(
            `corridor.join_sides: ${this.map.corridors[rc].join_sides[0]} ${this.map.corridors[rc].join_sides[1]}`
          );
          continue;
        }
        sceneCorridors[i].push({ x: exitpoint[0], y: exitpoint[1] });
      }
    }

    return {
      corridors: sceneCorridors,
      main: r.main,
      inter: r.inter,
      x: r.x,
      y: r.y,
      w: r.w,
      l: r.l,
    };
  }

  /**
   * Load the raw source map data into the map instance. Resets any previously loaded data
   * @param {string} mapsource
   */
  loadSource(mapsource, opts) {
    this._resetMap();

    let m = mapsource;
    if (typeof m === "string") {
      m = JSON.parse(m);
    }

    this.map.rooms = m?.model?.rooms;
    this.map.corridors = m?.model?.corridors;
    for (let i = 0; i < this.map.rooms.length; i++) {
      // Allow for arbitrary props to be added. Currently this is used to
      // facilitate demo content
      this.scenes.push({ ...this._locationScene(i), ...opts?.scene?.[i] });
    }

    [this.minRoomDimension, this.maxRoomDimension] = roomSideMinMax(
      this.map.rooms
    );
  }

  getScalingAttributes(targetWidth, targetHeight) {
    const [tx, ty, scalex, scaley] = this.calcTargetTransform(
      targetWidth,
      targetHeight
    );
    const [averageWidth, averageLength] = sourceRoomAverageBounds(
      this.map.rooms
    );
    return {
      tx,
      ty,
      scalex,
      scaley,
      averageWidth,
      averageLength,
    };
  }

  /**
   * AABB return an axis aligned bounding box for the map
   * @returns {[number, number, number, number]}
   */
  AABB() {
    let [minx, miny, maxx, maxy] = sourceRoomBounds(this.map.rooms);
    const [cminx, cminy, cmaxx, cmaxy] = sourceCorridorBounds(
      this.map.corridors
    );
    if (cminx < minx) minx = cminx;
    if (cminy < miny) miny = cminy;
    if (cmaxx > maxx) maxx = cmaxx;
    if (cmaxy > maxy) maxy = cmaxy;
    return [minx, miny, maxx, maxy];
  }

  /**
   * calcTargetTransform calculates the necessary translation and scale required
   * to place the objects in the target area.

   * @param {number} targetWidth
   * @param {number} targetLength
   * @returns {[number, number, number, number]} [offx, offy, scalex, scaley]
   */
  calcTargetTransform(targetWidth, targetLength) {
    let [offx, offy, scalex, scaley] = [
      targetWidth / 2,
      targetLength / 2,
      1,
      1,
    ];

    if (!(this.map.rooms || this.map.corridors)) {
      return [offx, offy, scalex, scaley];
    }

    const [minx, miny, maxx, maxy] = this.AABB();

    const mapWidth = maxx - minx;
    const mapLength = maxy - miny;
    // offx = minx / 2 + mapWidth / 2;
    // offy = miny / 2 + mapLength / 2;
    // offx = mapWidth / 2;
    // offy = mapLength / 2;
    offx = -minx;
    offy = -miny;

    scalex = targetWidth / mapWidth;
    scaley = targetLength / mapLength;

    return [offx, offy, scalex, scaley];
  }
}
