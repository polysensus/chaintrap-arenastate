import { ethers } from "ethers";

export function undefinedIfZeroBytesLike(maybeBytes) {
  if (ethers.utils.isBytesLike(maybeBytes)) {
    if (ethers.utils.stripZeros(maybeBytes).length === 0) return undefined;
    return maybeBytes;
  }
  return maybeBytes;
}
