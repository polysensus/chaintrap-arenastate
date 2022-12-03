import { ethers } from "ethers";

import doc from "@polysensus/chaintrap-contracts/abi/Arena.json" assert { type: "json" };
const { abi } = doc;

export function arenaConnect(signerOrProvider, address) {
  return new ethers.Contract(address, abi, signerOrProvider);
}
