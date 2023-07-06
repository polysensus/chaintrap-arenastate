import { ethers } from "ethers";
import { getArenaAddress } from "./arenaaddress.js";
import { arenaConnect } from "../lib/arenaabi.js";
import { readKey } from "./readkey.js";

export function programConnect(program, polling = false, key = null) {
  const url = program.opts().url;

  let provider;
  if (!polling) {
    provider = new ethers.providers.StaticJsonRpcProvider(url);
  } else {
    provider = new ethers.providers.JsonRpcProvider(url);
  }

  let signer = readKey(key ?? program.opts().key);
  if (signer) {
    signer = new ethers.Wallet(signer, provider);
  }
  return signer ? signer : provider;
}

export function urlConnect(url, opts) {
  let { key, polling, pollingInterval } = opts;

  let provider;
  if (!polling) {
    provider = new ethers.providers.StaticJsonRpcProvider(url);
  } else {
    provider = new ethers.providers.JsonRpcProvider(url);
    if (typeof pollingInterval !== 'undefined')
      provider.pollingInterval = pollingInterval;
  }

  let signer = readKey(key);
  if (signer) {
    signer = new ethers.Wallet(signer, provider);
  }
  return signer ? signer : provider;
}

export async function programConnectArena(program, options) {
  const provider = programConnect(program);
  const arena = await getArenaAddress(program, options, provider);
  return arenaConnect(arena, provider);
}
