import { ethers } from "ethers";
import { isFile, readHexKey } from "./fsutil.js";

import { deriveContractAddress } from "@polysensus/diamond-deploy";
import { programConnect } from "./connect.js";

import { getLogger } from "../lib/log.js";
import { resolveHardhatKey } from "../lib/hhkeys.js";

const log = getLogger("arenaaddress");
const out = console.log;

export async function getArenaAddress(program, _ /*options*/, provider) {
  const vout = program.opts().verbose ? console.log : () => {};

  let key = program.opts().deploykey;
  let acc = program.opts().deployacc;
  let addr = program.opts().arena;

  if (!key && !acc && !addr) {
    throw new Error(
      "To identify the arena contract to interact with, you must supply the deployer wallet key, the deployer wallet, a hardhat deploy.json or the explicit arena contract address"
    );
  }

  if (addr) {
    return addr;
  }

  if (key) {
    if (isFile(key)) {
      key = readHexKey(key);
    } else {
      key = resolveHardhatKey(key);
    }
    acc = new ethers.Wallet(key).address;
  }
  vout(`deployer wallet: ${acc}`);

  if (!provider) {
    provider = programConnect(program);
  }

  const arena = await deriveContractAddress(provider, acc, {
    log,
    nonce: program.opts().deploynonce,
  });
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
