import { programConnectArena } from "./connect.js";
import { Trialist } from "../lib/trialist.js";
import { findGids } from "../lib/arenaevent.js";
import { EventParser } from "../lib/chainkit/eventparser.js";
import { ArenaEvent } from "../lib/arenaevent.js";
import { asGid } from "../lib/gid.js";

const out = console.log;

export function addCommitChoice(program) {
  program
    .command("commitchoice")
    .option("--id <id>", "the game token id")
    .argument("side", "the location side to chose")
    .argument("exit", "the exit on the chosen side to take")
    .action((side, exit, options) =>
      commitchoice(program, options, side, exit)
    );
}

async function commitchoice(program, options, side, exit) {
  const arena = await programConnectArena(program, options);
  const eventParser = new EventParser(arena, ArenaEvent.fromParsedEvent);

  const gid = options.id ? asGid(options.id) : await findGids(eventParser, -1);

  const trialist = new Trialist(eventParser);
  await trialist.openTranscript(gid);

  // TODO: load the state roster to check that the provided side & exit are
  // available to the player. the contracts revert if they are wrong, so its not
  // super critical just confusing.

  await trialist.commitLocationChoice(gid, parseInt(side), parseInt(exit));
  const sideName = { 0: "north", 1: "west", 2: "south", 3: "east" }[side];
  console.log(`committed to exit ${exit} on the ${sideName} side`);
}
