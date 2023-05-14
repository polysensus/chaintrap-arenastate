import { Option } from "commander";
import {ethers} from "ethers";
import * as msgpack from "@msgpack/msgpack";

import { programConnectArena } from "./connect.js";

export function addJoingame2(program) {
  program
    .command("joingame2")
    .option("--id", "the game token id")
    .option("--nickname", "name to put in the profile string")
    .action((options) => joingame2(program, options));
}

async function joingame2(program, options) {
   const arenaAddress = program.opts().arena;
  if (!arenaAddress)
    throw new Error("The arena address must be supplied for this command");

  const arena = await programConnectArena(program, options);
  const iface = arena.getFacetInterface("ArenaFacet");
  const id = ethers.BigNumber.from(options.id);
  const profile = ethers.utils.arrayify(msgpack.encode({nickname:options.nickname}));
  const tx = await arena.registerParticipant(id, profile);
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