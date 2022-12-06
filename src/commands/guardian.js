import { ethers } from "ethers";
import { Game } from "@polysensus/chaintrap-contracts";
import { programConnectArena } from "./connect.js";
import { SceneLocation } from "../lib/scenelocation.js";
import { PlayerProfile } from "../lib/playerprofile.js";

import { loadRoster } from "../lib/stateroster.js";
import { MapModel } from "../lib/map/model.js";
import { readJson } from "./fsutil.js";
import { jfmt } from "./util.js";

const hexStripZeros = ethers.utils.hexStripZeros;

const out = console.log;
let vout = () => {};

export async function creategame(program, options) {
  if (program.opts().verbose) vout = out;
  const arena = await programConnectArena(program, options);

  const r = await arena.createGame(options.maxplayers);
  out(jfmt(r));
}

export async function startgame(program, options) {
  if (program.opts().verbose) vout = out;
  const arena = await programConnectArena(program, options);

  let gid = options.gid;
  if (typeof gid === "undefined" || gid < 0) {
    gid = await arena.lastGame();
  }
  const g = new Game(arena, gid);
  const r = await g.startGame();
  out(jfmt(r));
}

export async function completegame(program, options) {
  if (program.opts().verbose) vout = out;
  const arena = await programConnectArena(program, options);

  let gid = options.gid;
  if (typeof gid === "undefined" || gid < 0) {
    gid = await arena.lastGame();
  }
  const g = new Game(arena, gid);
  const r = await g.completeGame();
  out(jfmt(r));
}

export async function setstart(program, options, player, room) {
  if (program.opts().verbose) vout = out;

  const mapfile = program.opts().map;
  if (!mapfile) {
    out(
      "a map file must be provided, use chaintrap-maptool to generate one or use one of its default examples"
    );
    return;
  }

  const arena = await programConnectArena(program, options);

  let gid = options.gid;
  if (typeof gid === "undefined" || gid < 0) {
    gid = await arena.lastGame();
  }

  const [snap, roster] = await loadRoster(arena, gid);
  roster.getChanges(snap);
  const players = roster.players;

  const p = players[player];
  if (!p) {
    out(`player: ${player} not found in current roster`);
    return;
  }
  if (p.state.startLocation && hexStripZeros(p.state.startLocation) != "0x") {
    out(
      `player: ${player} start location is already set. ${p.state.startLocation}`
    );
    return;
  }

  const map = readJson(mapfile);
  const model = new MapModel();
  model.loadSource(map);
  if (room > model.map.rooms.length) {
    out(`room: ${room} is not in the map`);
    return;
  }
  const scene = model.locationScene(room);
  const sloc = new SceneLocation({ scene, location: room });
  sloc.tokenize(true, true);

  const g = new Game(arena, gid);

  const r = await g.setStartLocation(player, sloc.token, sloc.blob);

  out(jfmt(r));
}

export async function allowexituse(program, options) {
  if (program.opts().verbose) vout = out;

  const arena = await programConnectArena(program, options);
  // const guardian = arena.signer.address;

  let gid = options.gid;
  if (typeof gid === "undefined" || gid < 0) {
    gid = await arena.lastGame();
  }

  const [snap, roster] = await loadRoster(arena, gid);
  roster.getChanges(snap);
  const players = roster.players;

  var pending = [];
  if (options.player) {
    if (!players[options.player]) {
      out(`player ${options.player} not found`);
      return;
    }
    if (!players[options.player].state.pendingExitUsed) {
      out(`no pending move for player ${options.player}`);
      return;
    }
    pending.push[options.player];
  } else {
    for (const [addr, p] of Object.entries(players)) {
      if (!p.state.pendingExitUsed) continue;
      pending.push(p);
    }
    if (pending.length === 0) {
      out("no players with pending moves");
      return;
    }
  }

  // defer the map to here so we can check for pending without supplying a map file
  const mapfile = program.opts().map;
  if (!mapfile) {
    out(
      "a map file must be provided, use chaintrap-maptool to generate one or use one of its default examples"
    );
    return;
  }

  const map = readJson(mapfile);
  const model = new MapModel();
  model.loadSource(map);

  const g = new Game(arena, gid);
  for (const p of pending) {
    const profile = new PlayerProfile().decode(p.profile);
    const eid = p.lastEID;
    const ui = p.useExit[eid];
    const side = ui.exitUse.side;
    const egressIndex = ui.exitUse.egressIndex;

    const sloc = SceneLocation.fromBlob(p.state.sceneblob, true, true);
    const scene = sloc.scene;
    if (side >= scene.corridors.length) {
      out(
        `${profile.nickname} ${eid}: side ${side} not valid for current scene ${p.address}`
      );
      return;
    }

    if (egressIndex >= scene.corridors[side]) {
      out(
        `${profile.nickname} ${eid}: exit ${egressIndex} invalid for selected side ${side} ${p.address}`
      );
      return;
    }

    // Ok, the move is valid, build the new scene

    // XXX: TODO this whole business with tokenizing (small t) the locations is
    // still an unfinished mess. its actually there on the chain plain as day at
    // the moment...

    const loc = Number(sloc.location);
    if (loc > model.map.rooms.length) {
      out(
        `${profile.nickname} ${eid}: location ${loc} not found on map ${p.address}`
      );
      return;
    }

    const room = model.map.rooms[loc];
    const icor = room.corridors[side][egressIndex];
    const joins = model.map.corridors[icor].joins;
    const join_sides = model.map.corridors[icor].join_sides;
    // pick the join side that is not the current room
    const locnext = joins[0] == loc ? joins[1] : joins[0];
    const enterside = joins[0] == loc ? join_sides[1] : join_sides[0];

    // the exit index is the only exit on the side connected to the ajoining corridor
    let ingressExit;
    var corridorsnext = model.map.rooms[locnext].corridors;
    for (var i = 0; i < corridorsnext.length; i++) {
      if (corridorsnext[i] == icor) {
        ingressExit = i;
        break;
      }
    }
    if (!ingressExit) {
      out(
        `${profile.nickname} ${eid}:no matching ingress for corridor ${icor} joining ${joins[0]} -> ${joins[1]}:${p.address}`
      );
      return;
    }

    const scenenext = model.locationScene(locnext);
    const slocnext = new SceneLocation({ scene: scenenext, location: locnext });
    slocnext.tokenize(true, true);

    out(
      `${profile.nickname} ${eid}:ok "${side}:${egressIndex}" room ${loc} => ${locnext}:${p.address}`
    );
    if (!options.commit) {
      continue;
    }
    const r = await g.allowExitUse(
      eid,
      slocnext.token,
      slocnext.blob,
      enterside,
      ingressExit,
      options.halt
    );

    vout(jfmt(r));
  }
  !options.commit && out("re run with --commit|-c to execute the transactions");
}
