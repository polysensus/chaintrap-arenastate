import { ethers } from "ethers";
import { getArenaAddress } from "./arenaaddress.js";
import { arenaConnect } from "../lib/chaintrapabi.js";
import { isFile, readHexKey } from "./fsutil.js";
import doc from "@polysensus/chaintrap-contracts/abi/Arena.json" assert { type: "json" };
export const { abi } = doc;

export function programConnect(program, polling = false) {
  const url = program.opts().url;

  let provider;
  if (!polling) {
    provider = new ethers.providers.StaticJsonRpcProvider(url);
  } else {
    provider = new ethers.providers.JsonRpcProvider(url);
  }

  let signer = program.opts().key;
  if (signer) {
    if (isFile(signer)) {
      signer = readHexKey(signer);
    }
    signer = new ethers.Wallet(signer, provider);
  }
  return signer ? signer : provider;
}

export async function programConnectArena(program, options) {
  const provider = programConnect(program);
  const arena = await getArenaAddress(program, options, provider);
  return arenaConnect(provider, arena, abi);
}
