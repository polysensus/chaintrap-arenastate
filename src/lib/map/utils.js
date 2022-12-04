// lib deps
// framework imports
// app
import { isUndefined } from "../idioms.js";

export function essentiallyEq(a, b, factor = 10) {
  return Math.abs(a - b) < 10 * Number.MIN_VALUE;
}

export function sourceCorridorBounds(corridors) {
  let minx = Number.MAX_SAFE_INTEGER;
  let miny = Number.MAX_SAFE_INTEGER;
  let maxx = Number.MIN_SAFE_INTEGER;
  let maxy = Number.MIN_SAFE_INTEGER;

  if (isUndefined(corridors)) {
    return [minx, miny, maxx, maxy];
  }

  for (let i = 0; i < corridors.length; i++) {
    for (let j = 0; j < corridors[i].length; j++) {
      const { x, y } = corridors[i][j];
      if (x < minx) {
        minx = x;
      }
      if (y < miny) {
        miny = y;
      }
      if (x > maxx) {
        maxx = x;
      }
      if (y > maxy) {
        maxy = y;
      }
    }
  }
  return [minx, miny, maxx, maxy];
}

export function minRoomDimension(rooms) {
  return roomSideMinMax(rooms)[0];
}

/**
 * sourceRoomBounds calculates the bounding rectangle of the rooms (rooms as
 * read from the map source format).
 * @param {any[]} rooms the list of rooms from the map source
 * @returns {[minx, miny, maxx, maxy]}
 */
export function sourceRoomBounds(rooms) {
  let minx = Number.MAX_SAFE_INTEGER;
  let miny = Number.MAX_SAFE_INTEGER;
  let maxx = Number.MIN_SAFE_INTEGER;
  let maxy = Number.MIN_SAFE_INTEGER;

  if (isUndefined(rooms)) {
    return [minx, miny, maxx, maxy];
  }
  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].x - rooms[i].w * 2 < minx) {
      minx = rooms[i].x - rooms[i].w;
    }
    if (rooms[i].y - rooms[i].l * 2 < miny) {
      miny = rooms[i].y - rooms[i].l;
    }

    if (rooms[i].x + rooms[i].w * 2 > maxx) {
      maxx = rooms[i].x + rooms[i].w;
    }

    if (rooms[i].y + rooms[i].l * 2 > maxy) {
      maxy = rooms[i].y + rooms[i].l;
    }
  }
  return [minx, miny, maxx, maxy];
}

/**
 * avgRoomBounds calculates the average bounding rectangle of the rooms (rooms as
 * read from the map source format).
 * @param {any[]} rooms the list of rooms from the map source
 * @returns {[averageWidth, averageLength]}
 */
export function sourceRoomAverageBounds(rooms) {
  let width = 0;
  let length = 0;

  for (let i = 0; i < rooms.length; i++) {
    length += rooms[i].l;
    width += rooms[i].w;
  }

  return [width / rooms.length, length / rooms.length];
}

/**
 * minRoomDimension calcuates the smallest rooms smallest dimention
 * @param {any[]} rooms
 * @returns the smallest dimension of any room
 */
export function roomSideMinMax(rooms) {
  let maxw = Number.MIN_SAFE_INTEGER;
  let maxl = Number.MIN_SAFE_INTEGER;
  let minw = Number.MAX_SAFE_INTEGER;
  let minl = Number.MAX_SAFE_INTEGER;

  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].w < minw) {
      minw = rooms[i].w;
    }
    if (rooms[i].l < minl) {
      minl = rooms[i].l;
    }
    if (rooms[i].w > maxw) {
      maxw = rooms[i].w;
    }
    if (rooms[i].l > maxl) {
      maxl = rooms[i].l;
    }
  }

  const min = minw < minl ? minw : minl;
  const max = maxw > maxl ? maxw : maxl;
  return [min, max];
}
