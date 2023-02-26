import { ethers } from "ethers";
import { Game } from "@polysensus/chaintrap-contracts";
import { programConnectArena } from "./connect.js";
import { PlayerProfile } from "../lib/playerprofile.js";
import { loadRoster } from "../lib/stateroster.js";
import { SceneCatalog } from "../lib/map/scenecatalog.js";
import { Scene } from "../lib/map/scene.js";
import { findRoomToken } from "../lib/map/rooms.js";
import { readJson } from "./fsutil.js";
import { jfmt } from "./util.js";

const hexStripZeros = ethers.utils.hexStripZeros;
const arraify = ethers.utils.arrayify;

const out = console.log;
let vout = () => {};

export async function joingame(program, options, nickname) {
  if (program.opts().verbose) vout = out;
  const arena = await programConnectArena(program, options);

  let gid = options.gid;
  if (typeof gid === "undefined" || gid < 0) {
    gid = await arena.lastGame();
  }

  const g = new Game(arena, gid);

  const profile = new PlayerProfile({
    nickname,
    character: options.character ?? "assasin",
  }).encode();
  const r = await g.joinGame(profile);
  out(jfmt(r));
}

export async function commitexituse(program, options) {
  if (program.opts().verbose) vout = out;

  let [side, exit] = options.sideexit.split(":");
  side = Number(side);
  exit = Number(exit);

  const arena = await programConnectArena(program, options);
  if (!arena.signer) {
    out("You must provide a wallet --key");
    return;
  }

  const player = arena.signer.address;

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

  if (!p.state?.sceneblob || hexStripZeros(p.state?.sceneblob) == "0x") {
    out(`scene not set for player ${p.address}`);
    return;
  }

  const [_, scene] = Scene.decodeblob(p.state.sceneblob);
  if (side >= scene.corridors.length) {
    out(`side ${side} not valid for current scene`);
    return;
  }

  if (exit >= scene.corridors[side]) {
    out(`exit ${exit} invalid for selected side ${side}`);
    return;
  }

  const g = new Game(arena, gid);
  const eid = await g.commitExitUse(side, exit);
  out(jfmt(eid));
}

// --- inspection only calls follow

export async function listplayers(program, options) {
  if (program.opts().verbose) vout = out;
  const arena = await programConnectArena(program, options);

  let gid = options.gid;
  if (typeof gid === "undefined" || gid < 0) {
    gid = await arena.lastGame();
  }

  const g = new Game(arena, gid);

  const filters = ["nostart", "start", "nothalted"];

  if (options.filter && !filters.includes(options.filter)) {
    out(`filter must be one of ${filters}, not ${options.filter}`);
    return;
  }

  const count = await g.playerCount();
  for (var i = 0; i < count; i++) {
    const p = await g.playerByIndex(i);
    vout(jfmt(p));
    const profile = new PlayerProfile().decode(p.profile);

    if (options.filter == "nostart") {
      if (p.startLocation && hexStripZeros(p.startLocation) != "0x") continue;
    }
    if (options.filter == "start") {
      if (!p.startLocation || hexStripZeros(p.startLocation) == "0x") continue;
    }

    if (!options.scene) {
      out(profile.nickname, p.addr);
      continue;
    }

    const map = readMap(program);
    let scat;
    let scene = {};
    let start = undefined;
    let location = undefined;

    if (typeof map !== "undefined") {
      scat = new SceneCatalog();
      scat.load(map);
    }

    if (p.sceneblob && hexStripZeros(p.sceneblob) != "0x") {
      [location, scene] = Scene.decodeblob(arraify(p.sceneblob));
    }

    if (typeof scat !== "undefined") {
      if (p.startLocation && hexStripZeros(p.startLocation) != "0x") {
        const ir = findRoomToken(
          map.model.rooms.length,
          p.addr,
          p.startLocation,
          0,
          scat.hashAlpha
        );
        start = ir >= 0 ? scat.scenes[ir] : p.startLocation;
      }
      if (location && hexStripZeros(location) != "0x") {
        const ir = findRoomToken(
          map.model.rooms.length,
          p.addr,
          location,
          0,
          scat.hashAlpha
        );
        location = ir >= 0 ? scat.scenes[ir] : location;
      }
    }

    const player = {
      address: p.addr,
      location: location,
      scene,
      start,
      profile,
    };
    out(jfmt(player));
    // const profile = new PlayerProfile({nickname, character: options.character ?? "assasin"}).encode()
  }
}

function readMap(program) {
  const mapfile = program.opts().map;
  if (!mapfile) {
    vout("the map file is required to decode the start location");
    return undefined;
  }
  return readJson(mapfile);
}
