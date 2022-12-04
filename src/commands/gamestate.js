import { programConnect } from "./connect.js";
import { getArenaAddress } from "./arenaaddress.js";
import { arenaConnect } from "../lib/chaintrapabi.js";
import {
  findGameEvents,
  parseEventLog,
  getGameCreatedBlock,
} from "../lib/gameevents.js";

import { jfmt } from "./util.js";

import { StateRoster, loadRoster } from "../lib/stateroster.js";

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

export async function gamelog(program, options) {
  let vlog = () => {};
  if (program.opts().verbose) vlog = log;

  let gid = options.gid;

  const provider = programConnect(program);
  const address = await getArenaAddress(program, options, provider);
  const arena = arenaConnect(provider, address);

  if (typeof gid === "undefined" || gid < 0) {
    gid = await arena.lastGame();
  }

  const gameCreatedBlock = getGameCreatedBlock(arena, gid);
  vlog(`Arena: ${address} ${gid}`);
  for (const ethlog of await findGameEvents(arena, gid, gameCreatedBlock)) {
    log(JSON.parse(JSON.stringify(parseEventLog(arena, ethlog)), null, 2));
  }
}

export async function stateroster(program, options) {
  if (program.opts().verbose) vout = out;

  const provider = programConnect(program);
  const address = await getArenaAddress(program, options, provider);
  const arena = arenaConnect(provider, address);

  const [snap, roster] = loadRoster(arena, options.gid);
  roster.dispatchChanges(snap, dispatch ?? ((player) => out(jfmt(player))));
}
