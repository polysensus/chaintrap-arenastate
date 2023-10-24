import {
  prepareGuardian,
  prepareArena,
  fetchCodex,
} from "./prepareguardian.js";

import { ArenaEvent } from "../lib/arenaevent.js";
import { EventParser } from "../lib/chainkit/eventparser.js";

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

  const guardian = await prepareGuardian(eventParser, program, options);
  const { gid, codex } = await fetchCodex(program, { ...options, eventParser });

  guardian.setupTrial(codex, { ikey: 0 });

  await guardian.startListening2(gid, guardian.preparedDungeon());
  const resolved = await guardian.resolvePending(gid);
  if (resolved.length === 0)
    console.log(`no pending choices for ${gid.toHexString()}`);
  else
    console.log(
      `resolved ${resolved.length} pending choices for ${gid.toHexString()}`
    );
  process.exit();
}
