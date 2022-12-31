// libs
import { ethers } from "ethers";
import { sourceRoomAverageBounds } from "./utils";
// app
export class SceneCatalog {
  construct() {}

  /**
   *
   * @param {object} model as the raw json object representation obtained from the generator api
   */
  load(map) {
    this.hashAlpha = ethers.utils.sha256(
      ethers.utils.toUtf8Bytes(map.vrf_inputs.alpha)
    );
    const model = map.model;

    const [averageWidth, averageLength] = sourceRoomAverageBounds(model.rooms);

    this.scenes = []; // 1:1 with rooms
    for (var i = 0; i < model.rooms.length; i++) {
      const [scene, issues] = createScene(
        model,
        i,
        averageWidth,
        averageLength
      );
      if (issues.length > 0) {
        throw new Error(`issues with room ${i}: ${JSON.stringify(issues)}`);
      }
      this.scenes.push(scene);
    }
  }
  scene(room) {
    return this.scenes[room];
  }
}

export function createScene(
  model,
  roomIndex,
  intersectionWidth,
  intersectionLength
) {
  if (roomIndex >= model.rooms.length) {
    throw Error(`room ${roomIndex} out of range. have ${model.rooms.length}`);
  }
  const room = model.rooms[roomIndex];
  if (room.inter)
    return createIntersectionScene(
      model.rooms,
      model.corridors,
      roomIndex,
      intersectionWidth,
      intersectionLength
    );

  return createRoomScene(model.rooms, model.corridors, roomIndex);
}

/**
 *
 * @param {*} rooms
 * @param {*} corridors
 * @param {*} roomIndex
 * @param {*} w width to use for the fake intersection room (ususaly avg width for all)
 * @param {*} l length to use for the fake intersection room
 */
export function createIntersectionScene(rooms, corridors, roomIndex, w, l) {
  if (roomIndex >= rooms.length) {
    throw Error(`room ${roomIndex} out of range. have ${rooms.length}`);
  }

  const sceneCorridors = [[], [], [], []];
  const room = rooms[roomIndex];
  const issues = [];

  // For intersections, we just make up an 'average' square room and place the
  // exit points centrally on the corresponding sides. When we render the scene
  // we can knock out the corners to make it look more like an intersection.
  const [x, y] = [room.x, room.y];
  const xwest = x - w / 2;
  const xeast = x + w / 2;
  const ynorth = y - l / 2;
  const ysouth = y + 1 / 2;

  const points = [
    { x, y: ynorth },
    { x: xwest, y },
    { x, y: ysouth },
    { x: xeast, y },
  ];

  for (let i = 0; i < 4; i++) {
    if (room.corridors[i].length > 1) {
      issues.push([
        "a valid interesection only has one exit per side",
        room.corridors.length,
      ]);
      continue;
    }
    if (!room.corridors[i].length) {
      continue;
    }

    // Even though we discard the point, check the topology is ok
    const ic = room.corridors[i][0];
    if (
      corridors[ic].join_sides[0] !== i &&
      corridors[ic].join_sides[1] !== i
    ) {
      issues.push([
        `corridor ${ic} join_sides does not connect to the room`,
        i,
        ic,
      ]);
      continue;
    }
    sceneCorridors[i].push({ x: points[i].x, y: points[i].y });
  }

  return [
    {
      corridors: sceneCorridors,
      main: room.main,
      inter: room.inter,
      x,
      y,
      w,
      l,
    },
    issues,
  ];
}

export function createRoomScene(rooms, corridors, roomIndex) {
  if (roomIndex >= rooms.length) {
    throw Error(`room ${roomIndex} out of range. have ${rooms.length}`);
  }

  const sceneCorridors = [[], [], [], []];
  const room = rooms[roomIndex];
  const issues = [];

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < room.corridors[i].length; j++) {
      const ic = room.corridors[i][j];
      const roomside = i;
      // get the point matching the roomside

      let exitpoint;
      if (corridors[ic].join_sides[0] === roomside) {
        exitpoint = corridors[ic].points[0];
      } else if (corridors[ic].join_sides[1] === roomside) {
        exitpoint = corridors[ic].points[corridors[ic].points.length - 1];
      } else {
        issues.push([roomside, ic]);
        continue;
      }
      sceneCorridors[i].push({ x: exitpoint[0], y: exitpoint[1] });
    }
  }

  return [
    {
      corridors: sceneCorridors,
      main: room.main,
      inter: room.inter,
      x: room.x,
      y: room.y,
      w: room.w,
      l: room.l,
    },
    issues,
  ];
}
