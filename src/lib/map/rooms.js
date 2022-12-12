import { scenetoken } from "./scene.js";

import { getLogger } from "../log.js";
const log = getLogger("map.rooms");

export function connectedRooms(model, subjectRoom) {
  const r = model.rooms[subjectRoom];
  const reachable = [];

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < r.corridors[i].length; j++) {
      reachable.push(targetRoom(model, subjectRoom, i, j));
    }
  }

  return reachable;
}

export function targetRoom(
  model,
  subjectRoom,
  egressSide,
  egressIndex,
  nothrow = false
) {
  const r = model.rooms[subjectRoom];
  const rc = r.corridors[egressSide][egressIndex];

  // the connected room is the room attached to the 'other' side of the
  // corridor we detect that by first seeing which side is connected to
  // the subject room.  it is geometrically impossible, given how we
  // generate our maps, for the corridor to enter the same side of two
  // connected rooms.
  if (model.corridors[rc].join_sides[0] === egressSide) {
    return model.corridors[rc].joins[1];
  } else if (model.corridors[rc].join_sides[1] === egressSide) {
    return model.corridors[rc].joins[0];
  } else {
    if (nothrow === true) {
      return -1;
    }
    throw new Error(
      `room ${iroom}, side ${egressSide}, corridor ${rc} not correctly connected`
    );
  }
}

export function targetRoomIngress(model, subjectRoom, egressSide, egressIndex) {
  const r = model.rooms[subjectRoom];

  // if egressSide > 3 || egressIndex >= r.corridors[egressSide].length
  const rc = r.corridors[egressSide][egressIndex];

  let ir, ingressSide;

  // the connected room is the room attached to the 'other' side of the
  // corridor we detect that by first seeing which side is connected to
  // the subject room.  it is geometrically impossible, given how we
  // generate our maps, for the corridor to enter the same side of two
  // connected rooms.
  if (model.corridors[rc].join_sides[0] === egressSide) {
    ir = model.corridors[rc].joins[1];
    ingressSide = model.corridors[rc].join_sides[1];
  } else if (model.corridors[rc].join_sides[1] === egressSide) {
    ir = model.corridors[rc].joins[0];
    ingressSide = model.corridors[rc].join_sides[0];
  } else {
    throw new Error(
      `room ${iroom}, side ${egressSide}, corridor ${rc} egressSide not found`
    );
  }
  // To get the ingressExit, Search the destination room side for the corridor matching rc
  for (var i = 0; i < model.rooms[ir].corridors[ingressSide].length; i++) {
    if (model.rooms[ir].corridors[ingressSide][i] == rc) {
      return [ir, ingressSide, i];
    }
  }
  throw new Error(
    `room ${iroom}, side ${egressSide}, corridor ${rc} ingressSide and entrance not found`
  );
}

/**
 * Returns the room index for a location token
 * Uses the supplied parameters to make tokens for roomCount rooms. Returns the first match
 * @param {} model
 * @param {*} player
 * @param {*} token
 * @param {*} eid
 * @param {*} hashAlpha
 */
export function findRoomToken(roomCount, player, token, eid, hashAlpha) {
  for (var i = 0; i < roomCount; i++) {
    const derived = scenetoken(player, i, eid, hashAlpha);
    if (derived == token) {
      return i;
    }
  }
  return -1;
}

/**
 * Returns the room index for a location token, considering only those locations
 * connected to the provided location.
 * @param {*} model
 * @param {*} player
 * @param {*} lastLocation
 * @param {*} token
 * @param {*} eid
 * @param {*} hashAlpha
 * @returns
 */
export function findConnectedRoomToken(
  model,
  player,
  lastLocation,
  token,
  eid,
  hashAlpha
) {
  for (const i of connectedRooms(model, lastLocation)) {
    const derived = scenetoken(player, i, eid, hashAlpha);
    if (derived == token) {
      return i;
    }
  }
  return -i;
}

/**
 * Return the opposite side. Eg for east return west
 * @param {number} side
 */
export function oppositeSide(side) {
  // note: js % is 'remainder' not modulus but we know that all valid values
  // here are same sign (positive). so they are equivelant.
  return (side + 2) % 4;
}

/**
 * Given the room of egress return the room of ingress and the side
 * @param {*} room
 * @returns
 */
export function egressingEnters(c, room) {
  if (c.joins[0] === room) return [c.joins[1], c.join_sides[1]];
  if (c.joins[1] === room) return [c.joins[0], c.join_sides[0]];
  throw new Error(`room ${room} is not on either end of this corridor`);
}

/**
 * Check that corridor enters the room on the expected side and exit
 * @param {*} r
 * @param {number} corridor
 * @param {number} side
 */
export function ingressingExit(r, corridor, side) {
  for (let exit = 0; exit < r.corridors[side].length; exit++) {
    if (corridor === r.corridors[side][exit]) return exit;
  }
  return -1;
}
