import { ethers } from "ethers";
// import doc from "@polysensus/chaintrap-contracts/abi" assert { type: "json" };
import doc from "@polysensus/chaintrap-contracts/abi";
const { abi } = doc;

export function connect(address, signerOrProvider) {
  return new ethers.Contract(address, abi, signerOrProvider);
}
