import { ethers } from "ethers";
import { isFile, readHexKey, readJson } from "./fsutil.js";

import { deriveContractAddress } from "../lib/deriveaddress.js";
import { programConnect } from "./connect.js";

import { getLogger } from "../lib/log.js";

const log = getLogger("arenaaddress");
const out = console.log;

export async function getArenaAddress(program, options, provider) {
  const vout = program.opts().verbose ? console.log : () => {};

  let deployjson = program.opts().deployjson;
  let key = program.opts().deploykey;
  let acc = program.opts().deployacc;
  let addr = program.opts().arena;

  if (!deployjson && !key && !acc && !addr) {
    throw new Error(
      "To identify the arena contract to interact with, you must supply the deployer wallet key, the deployer wallet, a hardhat deploy.json or the explicit arena contract address"
    );
  }

  if (addr) {
    return addr;
  }

  if (key) {
    if (await isFile(key)) {
      key = await readHexKey(key);
    }
    acc = new ethers.Wallet(key).address;
  } else if (deployjson) {
    const hh = await readJson(deployjson);
    return hh.contracts.Arena.address;
  }

  vout(`deployer wallet: ${acc}`);
  if (!provider) {
    provider = programConnect(program);
  }

  const arena = await deriveContractAddress(
    provider,
    acc,
    program.opts().deploynonce
  );
  return arena;
}

export async function arenaAddress(program, options) {
  try {
    const addr = await getArenaAddress(program, options);
    out(addr);
  } catch (err) {
    log.warn(err);
  }
}