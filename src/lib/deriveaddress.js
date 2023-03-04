import { ethers } from "ethers";

const log = console.log;

export function addressFromKey(key) {
  return new ethers.Wallet(key).address;
}
