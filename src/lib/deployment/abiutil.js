import { ethers } from "ethers";

export function signatureSelector(signature) {
  return ethers.utils
    .keccak256(ethers.utils.toUtf8Bytes(signature))
    .slice(0, 2 + 8);
}
