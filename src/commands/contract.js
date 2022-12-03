import { ethers } from "ethers";
import { isFile, readHexKey } from "./fsutil.js";

import { deriveContractAddress } from "../lib/deriveaddress.js";
import { programConnect } from "./connect.js";

const log = console.log;

export async function contractAddress(program, options) {
  const vlog = program.opts().verbose ? log : () => {};

  let key = options.deploykey;
  let acc = options.deployacc;

  if (!key && !acc) {
    log("You must supply the deployer wallet key or wallet address");
    return 1;
  }

  if (key) {
    if (await isFile(key)) {
      key = await readHexKey(key);
    }
    acc = new ethers.Wallet(key).address;
  }

  vlog(`deployer wallet: ${acc}`);
  const provider = programConnect(program);

  const arena = await deriveContractAddress(provider, acc, options.nonce);
  log(arena);
}
