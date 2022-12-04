import { ethers } from "ethers";
import { Game } from "@polysensus/chaintrap-contracts";
import { programConnectArena } from "./connect.js";
import { PlayerProfile } from "../lib/playerprofile.js";
import { SceneLocation } from "../lib/scenelocation.js";
import { loadRoster } from "../lib/stateroster.js";
import { jfmt } from "./util.js";

const hexStripZeros = ethers.utils.hexStripZeros;

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

  const mapfile = program.opts().map;
  if (!mapfile) {
    out(
      "a map file must be provided, use chaintrap-maptool to generate one or use one of its default examples"
    );
    return;
  }

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
    out("scene not set for player ${");
  }

  const scene = SceneLocation.fromBlob(p.state.sceneblob, true, true).scene;
  if (side >= scene.corridors.length) {
    out(`side ${side} not valid for current scene`);
    return;
  }

  if (exit >= scene.corridors[side]) {
    out(`exit ${exit} invalid for selected side ${side}`);
    return;
  }

  const g = new Game(arena, gid);
  const r = await g.commitExitUse(side, exit);

  out(jfmt(r));
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
    const r = await g.playerByIndex(i);
    vout(jfmt(r));
    const profile = new PlayerProfile().decode(r.profile);

    if (options.filter == "nostart") {
      if (r.startLocation && hexStripZeros(r.startLocation) != "0x") continue;
    }
    if (options.filter == "start") {
      if (!r.startLocation || hexStripZeros(r.startLocation) == "0x") continue;
    }

    if (!options.scene) {
      out(profile.nickname, r.addr);
      continue;
    }

    let scene = {};
    if (r.sceneblob && hexStripZeros(r.sceneblob) != "0x") {
      const sloc = SceneLocation.fromBlob(r.sceneblob, true, true);
      scene = {
        location: sloc.location,
        scene: sloc.scene,
        token: sloc.token,
      };
    }
    let start = {};
    if (r.startLocation && hexStripZeros(r.startLocation) != "0x") {
      const sloc = SceneLocation.fromBlob(r.sceneblob, true, true);
      start = {
        location: sloc.location,
        scene: sloc.scene,
        token: sloc.token,
      };
    }

    const player = {
      address: r.addr,
      loc: r.loc,
      scene,
      start,
      profile,
    };
    out(jfmt(player));
    // const profile = new PlayerProfile({nickname, character: options.character ?? "assasin"}).encode()
  }
}
