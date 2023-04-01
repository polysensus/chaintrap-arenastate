import { ethers } from "ethers";
import { Game } from "@polysensus/chaintrap-contracts";
import { programConnectArena } from "./connect.js";
import { isHardhatAlias, hardhatKeyAliasAddress } from "../lib/hhkeys.js";
import { Scene, scenetoken } from "../lib/map/scene.js";
import { PlayerProfile } from "../lib/playerprofile.js";

import { loadRoster } from "../lib/stateroster.js";
import { readJson } from "./fsutil.js";
import { jfmt } from "./util.js";
import { storeERC1155GameMetadata } from "./metadata.js";

import { SceneCatalog } from "../lib/map/scenecatalog.js";
import { ABIName } from "../lib/abiconst.js";
import { findRoomToken, targetRoomIngress } from "../lib/map/rooms.js";

const hexStripZeros = ethers.utils.hexStripZeros;

const out = console.log;
let vout = () => {};

export async function creategame(program, options) {
  if (program.opts().verbose) vout = out;
  const arena = await programConnectArena(program, options);

  // We include the proof in the initial metadata
  const mapfile = program.opts().map;
  if (!mapfile) {
    out(
      "a map file must be provided, use chaintrap-maptool to generate one or use one of its default examples"
    );
    return;
  }
  const map = readJson(mapfile);

  let url = "";
  if (options.withmetadata) {
    const { stored, token } = await storeERC1155GameMetadata(
      arena.address,
      map,
      {
        name: options.name,
        iconfile: options.iconfile,
        nftstoragekey: options.nftstoragekey,
        openaikey: options.openaikey,
        properties: {
          maxplayers: options.maxplayers,
        },
      }
    );
    out(token.embed());
    out(token.url);
    url = token.url;
  }

  const tx = await arena.createGame({
    maxPlayers: options.maxplayers,
    tokenURI: url,
    mapVRFBeta: "0x",
  });
  const r = await tx.wait();
  out(jfmt(r));
  out(Object.keys(r));
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

  if (isHardhatAlias(player)) {
    player = hardhatKeyAliasAddress(player);
  }

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
  const map = readJson(mapfile);
  const scat = new SceneCatalog();
  scat.load(map);

  const [snap, roster, gameStates] = await loadRoster(arena, gid, {
    model: map.model,
    hashAlpha: scat.hashAlpha,
  });

  // If a game has started or completed it is not possible (or useful) to set
  // the player start location. And if it hasn't been created it is obviosly not
  // possible.
  if (
    !gameStates[ABIName.GameCreated] ||
    gameStates[ABIName.GameStarted] ||
    gameStates[ABIName.GameCompleted]
  ) {
    out(`inappropriate gameStates: ${JSON.stringify(gameStates)}`);
    return;
  }
  roster.getChanges(snap);
  const players = roster.players;

  const p = players[player];
  if (!p) {
    out(`player: ${player} not found in current roster`);
    return;
  }
  if (p.state.startLocation && hexStripZeros(p.state.startLocation) != "0x") {
    out(
      `player: ${player} resetting start location, was: ${p.state.startLocation}`
    );
  }

  if (p.last() != p.lastEID || p.lastEID != 0) {
    out(`Until the game starts last eid should be 0. ${p.last()} ${p.lastEID}`);
    return;
  }

  if (room > map.model.rooms.length) {
    out(`room: ${room} is not in the map`);
    return;
  }

  const locationToken = scenetoken(p.address, room, p.lastEID, scat.hashAlpha);
  const scene = scat.scene(room);
  const sceneblob = Scene.encodeblob(locationToken, scene);

  const g = new Game(arena, gid);
  const r = await g.setStartLocation(player, locationToken, sceneblob);

  out(jfmt(r));
  out(
    `player: ${p.address} start location token: ${locationToken}, ${p.location}`
  );
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
    pending.push[players[options.player]];
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
  const scat = new SceneCatalog();
  scat.load(map);

  const g = new Game(arena, gid);
  for (const p of pending) {
    const profile = new PlayerProfile().decode(p.profile);
    const eid = p.lastEID;
    const ui = p.useExit[eid];
    const side = ui.exitUse.side;
    const egressIndex = ui.exitUse.egressIndex;
    const [locationToken, scene] = Scene.decodeblob(p.state.sceneblob);

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

    // TODO: move the room token resolution into the StateRoster so we can use fincConnectedRoomToken.
    const ir = findRoomToken(
      map.model.rooms.length,
      p.address,
      locationToken,
      p.lastused(),
      scat.hashAlpha
    );
    if (ir < 0) {
      out(`location: ${locationToken} not found`);
      return;
    }

    let irNext, ingressSide, ingressExit;
    try {
      [irNext, ingressSide, ingressExit] = targetRoomIngress(
        map.model,
        ir,
        side,
        egressIndex,
        true
      );
    } catch (err) {
      out(err);
      return;
    }

    const sceneNext = scat.scene(irNext);
    const tokenNext = scenetoken(p.address, irNext, eid, scat.hashAlpha);
    const sceneblob = Scene.encodeblob(tokenNext, sceneNext);

    out(
      `${profile.nickname} ${eid}:ok "${side}:${egressIndex} -> ${ingressSide}:${ingressExit}" room ${ir} => ${irNext}:${p.address}`
    );
    if (!options.commit) {
      continue;
    }
    const r = await g.allowExitUse(
      eid,
      tokenNext,
      sceneblob,
      ingressSide,
      ingressExit,
      options.halt
    );

    out(jfmt(r));
  }
  !options.commit && out("re run with --commit|-c to execute the transactions");
}
