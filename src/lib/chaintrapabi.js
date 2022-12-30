import { ethers } from "ethers";

export function arenaConnect(signerOrProvider, address, abi) {
  return new ethers.Contract(address, abi, signerOrProvider);
}

export function arenaInterface(abi) {
  return new ethers.utils.Interface(abi);
}
