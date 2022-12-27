import {
  sourceCorridorBounds,
  sourceRoomBounds,
  sourceRoomAverageBounds,
  roomSideMinMax,
} from "./utils.js";

import { connectedRooms } from "./rooms.js";

import { getLogger } from "../log.js";
const log = getLogger("MapModel");

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
    this.model = {
      exits: [],
      rooms: [],
      corridors: [],
    };
  }

  /**
   * Returns a list of rooms reachable from the argument room
   * @param {*} iroom
   */
  connectedRooms(iroom) {
    return connectedRooms(this.model, iroom);
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

    this.model.rooms = m?.model?.rooms;
    this.model.corridors = m?.model?.corridors;

    [this.minRoomDimension, this.maxRoomDimension] = roomSideMinMax(
      this.model.rooms
    );
  }

  getScalingAttributes(targetWidth, targetHeight) {
    const [tx, ty, scalex, scaley] = this.calcTargetTransform(
      targetWidth,
      targetHeight
    );
    const [averageWidth, averageLength] = sourceRoomAverageBounds(
      this.model.rooms
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
    let [minx, miny, maxx, maxy] = sourceRoomBounds(this.model.rooms);
    const [cminx, cminy, cmaxx, cmaxy] = sourceCorridorBounds(
      this.model.corridors
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

    if (!(this.model.rooms || this.model.corridors)) {
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
