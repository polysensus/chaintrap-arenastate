import hre from "hardhat";

import { readKey } from "../../src/commands/readkey.js";
import { urlConnect } from "../../src/commands/connect.js";
import { arenaConnect } from "../../src/lib/chaintrapabi.js";
export { arenaConnect };

export function envConnect(options) {
  const key = options?.key ?? process.env.ARENASTATE_USER1_KEY;
  const url = options?.url ?? process.env.ARENASTATE_PROVIDER_URL;
  let polling = options?.polling;
  if (typeof polling === "undefined") polling = true;

  const arenaAddress = options?.arena ?? process.env.ARENASTATE_ARENA;

  const signer = urlConnect(url, {key, polling});
  return arenaConnect(arenaAddress, signer);
}

export const HH_DEPLOYER_ACCOUNT_INDEX=0;
export const HH_OWNER_ACCOUNT_INDEX=1;
export const HH_GUARDIAN_ACCOUNT_INDEX=10;
export const HH_USER1_ACCOUNT_INDEX=11;

/**
 * Connect an arena signer using an indexed hardhat (hre) account. See the HH_*
 * constants for well known uses.
 * 
 * @param {string} arenaAddress 
 * @param {{account:Number}} options 
 * @returns 
 */
export function hreConnect(arenaAddress, options) {
  const signers = hre.getSigners();
  let accountIndex = options.account;
  if (typeof accountIndex === "undefined") accountIndex = HH_USER1_ACCOUNT_INDEX;
  return arenaConnect(arenaAddress, signers[accountIndex]);
}

export function envConnectProvider(options) {
  const url = options?.url ?? process.env.ARENASTATE_PROVIDER_URL;
  let polling = options?.polling;
  if (typeof polling === "undefined") polling = true;

  const arenaAddress = options?.arena ?? process.env.ARENASTATE_ARENA;

  const provider = urlConnect(url, {polling});
  return arenaConnect(arenaAddress, provider);
}