import hre from "hardhat";

import { readKey } from "../../src/commands/readkey.js";
import { urlConnect } from "../../src/commands/connect.js";
import { arenaConnect } from "../../src/lib/arenaabi.js";
export { arenaConnect };

export function envConnect(arenaAddress, options) {
  const key = options?.key;
  const url = options?.url ?? process.env.ARENASTATE_PROVIDER_URL;
  let polling = options?.polling;
  if (typeof polling === "undefined") polling = true;

  arenaAddress = arenaAddress ?? process.env.ARENASTATE_ARENA;

  const signer = urlConnect(url, { key, polling, pollingInterval: options?.pollingInterval });
  return arenaConnect(arenaAddress, signer);
}

export const HH_DEPLOYER_ACCOUNT_INDEX = 0;
export const HH_OWNER_ACCOUNT_INDEX = 1;
export const HH_GUARDIAN_ACCOUNT_INDEX = 10;
export const HH_USER1_ACCOUNT_INDEX = 11;
export const HH_USER2_ACCOUNT_INDEX = 12;

/**
 * Connect an arena signer using an indexed hardhat (hre) account. See the HH_*
 * constants for well known uses.
 *
 * @param {string} arenaAddress
 * @param {{account:Number}} options
 * @returns
 */
export async function hreConnect(arenaAddress, options) {
  const signers = await hre.ethers.getSigners();
  if (typeof options?.account === "undefined")
    return arenaConnect(arenaAddress, hre.ethers.provider);
  return arenaConnect(arenaAddress, signers[options.account]);
}

export function envConnectProvider(options) {
  const url = options?.url ?? process.env.ARENASTATE_PROVIDER_URL;
  let polling = options?.polling;
  if (typeof polling === "undefined") polling = true;

  const arenaAddress = options?.arena ?? process.env.ARENASTATE_ARENA;

  const provider = urlConnect(url, { polling });
  return arenaConnect(arenaAddress, provider);
}
