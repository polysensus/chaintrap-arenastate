import { prepareGuardian, prepareArena } from "./prepareguardian.js";

import { asGid } from "../lib/gid.js";
import { ArenaEvent } from "../lib/arenaevent.js";
import { EventParser } from "../lib/chainkit/eventparser.js";
import { findGids } from "../lib/arenaevent.js";

const out = console.log;
let vout = () => {};

export function addResolveChoice(program) {
  program
    .command("resolvechoice")
    .option("--id <token>", "the game token id")
    .action((options) => resolvechoice(program, options));
}

async function resolvechoice(program, options) {
  if (program.opts().verbose) vout = out;

  const arena = await prepareArena(program, options);
  const eventParser = new EventParser(arena, ArenaEvent.fromParsedEvent);
  const gid = options.id ? asGid(options.id) : await findGids(eventParser, -1);

  const guardian = await prepareGuardian(eventParser, program, options);
  // TODO: load furniture
  guardian.finalizeDungeon();

  await guardian.startListening(gid);
  const resolved = await guardian.resolvePending(gid);
  if (resolved.length === 0)
    console.log(`no pending choices for ${gid.toHexString()}`);
  else
    console.log(
      `resolved ${resolved.length} pending choices for ${gid.toHexString()}`
    );
  process.exit();
}
