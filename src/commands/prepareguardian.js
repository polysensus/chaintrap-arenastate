import { readJson } from "./fsutil.js";
import { programConnectArena } from "./connect.js";
import { asGid } from "../lib/gid.js";
import { findGameMetadata, findGids } from "../lib/arenaevent.js";
import { GameMetadataReader } from "../lib/erc1155metadata/gamereader.js";
import { Guardian } from "../lib/guardian.js";
import { BlobCodex } from "@polysensus/blobcodex";

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

export async function fetchCodex(program, options) {
  const eventParser = options?.eventParser;
  const arena = eventParser?.contract ?? options.arena;

  const furnitureFilename = program.opts().furniture;
  let tokenId = program.opts()?.id ?? options.id;
  let metadataUrl =
    program.opts()?.codexMetadataUrl ?? options.codexMetadataUrl;
  const codexFromDisc = program.opts()?.codexFromDisc ?? options.codexFromDisc;
  const codexFilename = program.opts()?.codexFilename ?? options.codexFilename;
  const mapFilename = program.opts()?.map;

  const password =
    program.opts().codexPassword ?? options.codexPassword ?? null;

  const reader = new GameMetadataReader({ fetch, readJson, furnitureFilename });

  // fetch via explicitly provided metadata url ?
  if (metadataUrl && !codexFromDisc)
    return {
      codex: await reader.fetchTrialSetupCodex(metadataUrl, password, options),
    };

  // By default, find the latest game gid. Either using the supplied token id or
  // falling back to searching the contract events.
  let gid;
  if (!codexFromDisc) {
    if (tokenId) gid = asGid(tokenId);
    else if (eventParser) gid = await findGids(eventParser, -1);
  }

  // If we found a gid or were given a token *and* we are not forcing a read from disc
  if (gid && !codexFromDisc) {
    if (!eventParser)
      throw new Error(
        `arena contract is required to find the metadata url from the token id`
      );

    const metadataUrl = await findGameMetadata(arena, gid);
    return {
      gid,
      metadataUrl,
      codex: await reader.fetchTrialSetupCodex(metadataUrl, password, options),
    };
  }

  // if we get here we either forced reading from disc or we didn't have the
  // options necessary to attempt fetching from ipfs.

  if (codexFilename)
    return {
      gid,
      codexFilename,
      codex: await reader.readTrialSetupCodex(codexFilename, password, options),
    };

  // lastly try the pre-codex collection of maps + external furniture file
  if (!mapFilename)
    throw new Error(
      `please set appropriate options for reading or fetching the trial setup data`
    );

  return {
    gid,
    mapFilename,
    codex: await reader.trialSetupFromCollectionCodex(
      mapFilename,
      password,
      options
    ),
  };
}

export async function readMapFromBlobCodex(program, options, password) {
  const filename = program.opts().codexFilename ?? options.codexFilename;
  if (!filename) {
    throw new Error(
      "a blob codex file must be provided, use chaintrap-maptool to generate one"
    );
  }

  // Note: null passwords are specifically supported so that the codex can contain plain text blobs
  password =
    password ?? program.opts().codexPassword ?? options.codexPassword ?? null;

  const s = readJson(filename);

  // no need to deal with ikeys for now, we only use a single password for the map data.
  const codex = await BlobCodex.hydrate(s, [password]);
  return codex;
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
