import { programConnectArena } from "./connect.js";
import { Trialist } from "../lib/trialist.js";
import { EventParser } from "../lib/chainkit/eventparser.js";
import { ArenaEvent } from "../lib/arenaevent.js";
import { asGid } from "../lib/gid.js";
import { findGids } from "../lib/arenaevent.js";

const out = console.log;

export function addJoingame(program) {
  program
    .command("joingame")
    .option("--id <id>", "the game token id")
    .option("--nickname <name>", "name to put in the profile string")
    .action((options) => joingame(program, options));
}

async function joingame(program, options) {
  const arenaAddress = program.opts().arena;
  if (!arenaAddress)
    throw new Error("The arena address must be supplied for this command");

  const arena = await programConnectArena(program, options);

  const eventParser = new EventParser(arena, ArenaEvent.fromParsedEvent);
  const gid = options.id ? asGid(options.id) : await findGids(eventParser, -1);

  const trialist = new Trialist(eventParser);
  await trialist.joinGame(gid, options);
  out(`registered for ${gid.toHexString()}`);
}
