import { ethers } from "ethers";
import { programConnectArena } from "./connect.js";
import { Trialist } from "../lib/trialist.js";

const out = console.log;

export function addJoingame2(program) {
  program
    .command("joingame2")
    .option("--id <id>", "the game token id")
    .option("--nickname <name>", "name to put in the profile string")
    .action((options) => joingame2(program, options));
}

async function joingame2(program, options) {
  const arenaAddress = program.opts().arena;
  if (!arenaAddress)
    throw new Error("The arena address must be supplied for this command");

  const arena = await programConnectArena(program, options);
  const id = ethers.BigNumber.from(options.id);
  const trialist = new Trialist(arena);
  await trialist.joinGame(id, options);
  out(`registered for ${options.id}`);
}
