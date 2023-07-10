import { readJson } from "./fsutil.js";
import path from "path";
import { programConnectArena } from "./connect.js";
import { Guardian } from "../lib/guardian.js";
import { BlobCodex } from "../lib/secretblobs.js";
import { getMap } from "../lib/map/collection.js";

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

export async function readMap(program, options) {
  if (program.opts().codexFilename || options.codexFilename)
    return readMapFromBlobCodex(program, options);
  return readMapFromCollection(program, options);
}

export async function readMapFromCollection(program, options) {
  const mapfile = program.opts().map;
  if (!mapfile) {
    throw new Error(
      "a map file must be provided, use chaintrap-maptool to generate one or use one of its default examples"
    );
  }
  const collection = readJson(mapfile);

  const mapName = { ...program.opts(), ...options }.mapName;
  const { map, name } = getMap(collection, { mapName });
  return { map, name };
}

export async function readMapFromBlobCodex(program, options, password) {
  const filename = program.opts().codexFilename ?? options.codexFilename;
  if (!filename) {
    throw new Error(
      "a blob codex file must be provided, use chaintrap-maptool to generate one"
    );
  }

  password = password ?? program.opts().codexPassword ?? options.codexPassword;
  if (typeof password === "undefined")
    throw new Error(`a password must be supplied`);

  const s = readJson(filename);

  // no need to deal with ikeys for now, we only use a single password for the map data.
  const codec = await BlobCodex.hydrate(s, [password]);
  const id = codec.index["map"][0];
  const item = codec.items[id];
  const map = JSON.parse(item.blobs[0].value);
  // re-read the file from disc so we know we aren't posting anything unexpectedly in the clear to ipfs
  const encrypted = readJson(filename);
  return { map, name: path.basename(filename), encrypted };
}

export async function prepareGuardian(eventParser, program, options) {
  if (program.opts().verbose) vout = out;

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

  return guardian;
}
