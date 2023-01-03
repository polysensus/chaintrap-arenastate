import { ethers } from "ethers";
import { programConnect } from "./connect.js";
import { getArenaAddress } from "./arenaaddress.js";
import { arenaConnect } from "../lib/chaintrapabi.js";
import doc from "@polysensus/chaintrap-contracts/abi/Arena.json" assert { type: "json" };
export const { abi } = doc;

import {
  findGameEvents,
  parseEventLog,
  getGameCreatedBlock,
} from "../lib/gameevents.js";
import { SceneCatalog } from "../lib/map/scenecatalog.js";

import { jfmt } from "./util.js";
import { readJson } from "./fsutil.js";

import { loadRoster } from "../lib/stateroster.js";

const log = console.log;
const out = console.log;
const vout = () => {};

async function programConnectArena(program, options) {
  const provider = programConnect(program);
  const arena = await getArenaAddress(program, options, provider);
  return arenaConnect(provider, arena);
}

export async function lastGame(program, options) {
  const c = await programConnectArena(program, options);
  const gid = await c.lastGame();
  log(gid.toNumber());
}

export async function tokenuri(program, options, token) {
  let vlog = () => {};
  if (program.opts().verbose) vlog = log;

  let gid = options.gid;

  const provider = programConnect(program);
  const address = await getArenaAddress(program, options, provider);
  const arena = arenaConnect(provider, address, abi);

  const tok = ethers.BigNumber.from(token);
  const uri = await arena.uri(tok);
  out(uri);
}

export async function gamelog(program, options) {
  let vlog = () => {};
  if (program.opts().verbose) vlog = log;

  let gid = options.gid;

  const provider = programConnect(program);
  const address = await getArenaAddress(program, options, provider);
  const arena = arenaConnect(provider, address, abi);

  if (typeof gid === "undefined" || gid < 0) {
    gid = await arena.lastGame();
  }

  const gameCreatedBlock = getGameCreatedBlock(arena, gid);
  vlog(`Arena: ${address} ${gid}`);

  const ethlogs = await findGameEvents(arena, gid, gameCreatedBlock);
  if (options.raw) {
    out(JSON.stringify(ethlogs));
    return;
  }
  for (const elog of ethlogs) {
    log(
      JSON.parse(JSON.stringify(parseEventLog(arena.interface, elog)), null, 2)
    );
  }
}

export async function stateroster(program, options) {
  if (program.opts().verbose) vout = out;

  const provider = programConnect(program);
  const address = await getArenaAddress(program, options, provider);
  const arena = arenaConnect(provider, address, abi);

  let gid = options.gid;
  if (typeof gid === "undefined" || gid < 0) {
    gid = await arena.lastGame();
  }

  const gs = await arena.gameStatus(gid);
  out(`${JSON.stringify(gs)}`);

  let ropts;
  const mapfile = program.opts().map;
  if (mapfile) {
    const map = readJson(mapfile);
    const scat = new SceneCatalog();
    scat.load(map);
    ropts = { model: map.model, hashAlpha: scat.hashAlpha };
  }

  const [snap, roster] = await loadRoster(arena, gid, ropts);
  roster.dispatchChanges(snap, (player) => {
    out(`
    player: ${player.profile.nickname}
    address: ${player.address}
    room: ${player.location}
    pendingExitUsed: ${player.pendingExitUsed}
    `);
  });
}
