import { ethers } from "ethers";

export function programConnect(program, polling = false) {
  const url = program.opts().url;

  let provider;
  if (!polling) {
    provider = new ethers.providers.StaticJsonRpcProvider(url);
  } else {
    provider = new ethers.providers.JsonRpcProvider(url);
  }

  const key = program.opts().key;
  let signer;
  if (key) {
    signer = new ethers.Wallet(key, provider);
  }
  return signer ? signer : provider;
}
