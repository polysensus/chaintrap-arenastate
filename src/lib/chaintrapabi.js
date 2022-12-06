import { ethers } from "ethers";

import doc from "@polysensus/chaintrap-contracts/abi/Arena.json" assert { type: "json" };
export const { abi } = doc;

export function arenaConnect(signerOrProvider, address) {
  return new ethers.Contract(address, abi, signerOrProvider);
}

export function arenaInterface() {
  return new ethers.utils.Interface(abi);
}
