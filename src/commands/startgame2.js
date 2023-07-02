import { prepareGuardian, prepareGuardianArena } from "./prepareguardian.js";

import { asGid } from "../lib/gid.js";
import { Trial } from "../lib/trial.js";
import { Journal } from "../lib/journal.js";
import { ArenaEvent } from "../lib/arenaevent.js";
import { EventParser } from "../lib/chainkit/eventparser.js";

const out = console.log;
let vout = () => {};

export function addStartgame2(program) {
  program
    .command("startgame2")
    .option("--id <token>", "the game token id")
    .option("--starts <numbers...>")
    .action((options) => startgame2(program, options));
}

async function startgame2(program, options) {
  if (program.opts().verbose) vout = out;

  const arena = await prepareGuardianArena(program, options);
  const eventParser = new EventParser(arena, ArenaEvent.fromParsedEvent);

  const journal = new Journal(eventParser, options);
  const gid = asGid(options.id);
  const staticRootLabel = (await journal.staticRoot(gid)).rootLabel;

  journal.openTranscript(gid, staticRootLabel);

  const guardian = await prepareGuardian(arena, program, options);
  // TODO: load furniture
  guardian.finalizeDungeon();

  const trial = new Trial(gid, staticRootLabel, guardian.preparedDungeon());
  // now get the rootLabel for the initArgs

  const startArgs = trial.createStartGameArgs(
    options.starts.map((v) => parseInt(v))
  );

  const tx = await arena.startTranscript(gid, startArgs);
  const r = await tx.wait();
  for (const log of r.logs) {
    try {
      const parsed = eventParser.parse(log);
      out(parsed.name);
    } catch (err) {
      out(`${err}`);
    }
  }
}
