import {
  prepareGuardian,
  fetchCodex,
  prepareArena,
} from "./prepareguardian.js";

import { ArenaEvent } from "../lib/arenaevent.js";
import { EventParser } from "../lib/chainkit/eventparser.js";

const out = console.log;
let vout = () => {};

export function addStartgame(program) {
  program
    .command("startgame")
    .option("--id <token>", "the game token id")
    .option(
      "--codex-from-disc",
      `
set to forcibly ignore the metadata on the game token and instead require that
it is available locally on disc (other --codex-* options are then required to
locate it)`
    )
    .option(
      "--starts <numbers>",
      "comma separated list of start locations. listed in order of player registration"
    )
    .action((options) => startgame(program, options));
}

async function startgame(program, options) {
  if (program.opts().verbose) vout = out;

  const arena = await prepareArena(program, options);
  const eventParser = new EventParser(arena, ArenaEvent.fromParsedEvent);

  const { gid, codex } = await fetchCodex(program, { ...options, eventParser });

  const guardian = await prepareGuardian(eventParser, program, options);

  await guardian.codexStartListening(codex, gid, { ikey: 0 });
  await guardian.startGame(
    gid,
    ...options.starts.split(",").map((s) => parseInt(s))
  );
  console.log(`started game ${gid.toHexString()}`);
  await guardian.stopListening(gid);
  process.exit();
  // console.log(`stoped listeners for ${gid.toHexString()}`);
}
