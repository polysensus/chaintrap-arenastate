import { prepareGuardian, prepareArena } from "./prepareguardian.js";

import { asGid } from "../lib/gid.js";
import { ArenaEvent } from "../lib/arenaevent.js";
import { EventParser } from "../lib/chainkit/eventparser.js";
import { findGids } from "../lib/arenaevent.js";
import { readJson } from "./fsutil.js";

const out = console.log;
let vout = () => {};

export function addStartgame(program) {
  program
    .command("startgame")
    .option("--id <token>", "the game token id")
    .option("--starts <numbers...>")
    .action((options) => startgame(program, options));
}

async function startgame(program, options) {
  if (program.opts().verbose) vout = out;

  const arena = await prepareArena(program, options);
  const eventParser = new EventParser(arena, ArenaEvent.fromParsedEvent);
  const gid = options.id ? asGid(options.id) : await findGids(eventParser, -1);

  const guardian = await prepareGuardian(eventParser, program, options);
  const furniture = readJson(program.opts().furniture);
  guardian.furnishDungeon(furniture);
  guardian.finalizeDungeon();

  await guardian.openTranscript(gid);
  await guardian.startGame(gid, options.starts.map(parseInt));
  console.log(`started game ${gid.toHexString()}`);
}
