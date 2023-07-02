import { readJson } from "./fsutil.js";
import { programConnectArena } from "./connect.js";
import { Guardian } from "../lib/guardian.js";

const out = console.log;
let vout = () => {};

export async function prepareArena(program, options) {
  if (program.opts().verbose) vout = out;
  const arenaAddress = program.opts().arena;
  if (!arenaAddress)
    throw new Error("The arena address must be supplied for this command");

  const arena = await programConnectArena(program, options);
  return arena;
}

export async function prepareGuardian(eventParser, program, options) {
  if (program.opts().verbose) vout = out;
  const mapfile = program.opts().map;
  if (!mapfile) {
    throw new Error(
      "a map file must be provided, use chaintrap-maptool to generate one or use one of its default examples"
    );
  }

  const collection = readJson(mapfile);

  const guardianOptions = {
    ...program.opts(),
    ...options,
  };

  if (
    guardianOptions.gameIconFilename &&
    isFile(guardianOptions.gameIconFilename)
  ) {
    guardianOptions.gameIconBytes = readBinary(
      guardianOptions.gameIconFilename
    );
  }
  const guardian = new Guardian(eventParser, guardianOptions);
  guardian.prepareDungeon(collection, { mapName: guardianOptions.mapName });
  return guardian;
}
