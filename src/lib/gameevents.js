import { ethers } from "ethers";

export async function findGameCreated(arena, gid) {
  const filter = arena.filters["GameCreated(uint256,uint256)"](gid);
  const found = await arena.queryFilter(filter);

  if (found.length == 0) {
    log.warn("error: game not found");
    return undefined;
  }
  if (found.length > 1) {
    throw Error(`duplicate GameCreated events for gid: ${gid}`);
  }

  return found[0];
}

export async function getGameCreatedBlock(arena, gid) {
  return (await findGameCreated(arena, gid)).blockNumber;
}

/**
 * findGameEvents finds all events for the game. Returning them in the order
 * they were recorded on chain.
 *
 * To limit the events considered, provide fromBlock as the first positional
 * parameter.
 */
export async function findGameEvents(arena, gid, fromBlock) {
  const filter = {
    address: arena.address,
    topics: [
      null, // any event on the contract
      ethers.utils.hexZeroPad(gid.toHexString(), 32), // which has the game id as the first indexed paramater
    ],
  };
  return arena.queryFilter(filter, fromBlock);
}

/**
 * parseEventLog returns a normalised and (abi) parsed representation of an ethereum event log
 * @param {any} arena contract interface
 * @param {*} ethlog
 * @returns
 */
export function parseEventLog(arena, ethlog) {
  // See https://github.com/ethers-io/ethers.js/blob/master/packages/contracts/src.ts/index.ts addContractWait ~#342
  let parsed = null;

  try {
    parsed = arena.interface.parseLog(ethlog);
  } catch (e) {}

  if (!parsed) {
    return ethlog;
  }

  const event = ethlog;
  event.name = parsed.name;
  event.event = parsed.event;
  if (typeof event.event === "undefined") {
    event.event = event.name;
  }
  event.args = parsed.args;

  return event;
}
