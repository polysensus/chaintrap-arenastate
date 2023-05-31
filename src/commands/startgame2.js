import { ethers } from "ethers";
const arrayify = ethers.utils.arrayify;
const keccak256 = ethers.utils.keccak256;
import { readJson } from "./fsutil.js";

import { programConnectArena } from "./connect.js";
import { Trial } from "../lib/trial.js";

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
  const mapfile = program.opts().map;
  if (!mapfile) {
    out(
      "a map file must be provided, use chaintrap-maptool to generate one or use one of its default examples"
    );
    return;
  }

  if (!options.starts)
    throw new Error("one or more start locations need to be set");

  const arenaAddress = program.opts().arena;
  if (!arenaAddress)
    throw new Error("The arena address must be supplied for this command");

  const arena = await programConnectArena(program, options);
  const iface = arena.getFacetInterface("ArenaFacet");
  const id = ethers.BigNumber.from(options.id);

  const collection = readJson(mapfile);
  const trial = Trial.fromCollectionJSON(collection);
  const startArgs = trial.createStartGameArgs(
    options.starts.map((v) => parseInt(v))
  );

  const tx = await arena.startTranscript(id, startArgs);
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
