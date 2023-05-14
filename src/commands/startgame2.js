import {ethers} from "ethers";

import { programConnectArena } from "./connect.js";

export function addJoingame2(program) {
  program
    .command("startgame2")
    .option("--id", "the game token id")
    .action((options) => startgame2(program, options));
}

async function startgame2(program, options) {
   const arenaAddress = program.opts().arena;
  if (!arenaAddress)
    throw new Error("The arena address must be supplied for this command");

  const arena = await programConnectArena(program, options);
  const iface = arena.getFacetInterface("ArenaFacet");
  const id = ethers.BigNumber.from(options.id);
  const tx = await arena.startGame2(id);
  const r = await tx.wait();
   for (const log of r.logs) {
    try {
      const parsed = iface.parseLog(log);
      out(parsed.name);
    } catch (err) {
      out(`${err}`);
    }
   }
}