import { programConnect } from "./connect.js";
import { getArenaAddress } from "./arenaaddress.js";
import { arenaConnect } from "../lib/chaintrapabi.js";
import {
  findGameEvents,
  parseEventLog,
  getGameCreatedBlock,
} from "../lib/gameevents.js";

import { jfmt } from "./util.js";

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
  const arena = arenaConnect(provider, address);

  const [snap, roster] = await loadRoster(arena, options.gid);
  roster.dispatchChanges(snap, (player) => out(jfmt(player)));
}
