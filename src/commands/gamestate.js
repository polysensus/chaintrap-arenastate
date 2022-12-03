import { programConnect } from "./connect.js";
import { getArenaAddress } from "./arenaaddress.js";
import { arenaConnect } from "../lib/chaintrapabi.js";
import {
  findGameEvents,
  parseEventLog,
  getGameCreatedBlock,
} from "../lib/gameevents.js";

import { StateRoster } from "../lib/stateroster.js";

const log = console.log;
const out = console.log;

async function programConnectArena(program, options) {
  const provider = programConnect(program);
  const arena = await getArenaAddress(program, options, provider);
  return await arenaConnect(provider, arena);
}

export async function lastGame(program, options) {
  let vlog = () => {};
  if (program.opts().verbose) vlog = log;

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
  const arena = await arenaConnect(provider, address);

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
  let vlog = () => {};
  if (program.opts().verbose) vlog = log;

  let gid = options.gid;

  const provider = programConnect(program);
  const address = await getArenaAddress(program, options, provider);
  const arena = await arenaConnect(provider, address);

  if (typeof gid === "undefined" || gid < 0) {
    gid = await arena.lastGame();
  }

  const gameCreatedBlock = getGameCreatedBlock(arena, gid);
  vlog(`Arena: ${address} ${gid}`);
  const events = await findGameEvents(arena, gid, gameCreatedBlock);
  const roster = new StateRoster(arena, gid, (player) => {
    out(JSON.parse(JSON.stringify(player), null, 2));
  });
  roster.batchedUpdateBegin();
  roster.load(events);
  roster.batchedUpdateFinalize();
}
