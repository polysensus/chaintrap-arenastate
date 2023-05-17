import { ethers } from "ethers";

import { getLogger } from "./log.js";

import { GameEvent } from "./gameevent.js";
import { matchCustomError } from "./chaintrapabi.js";

const log = getLogger("gameevents");

/**
 * A helper class for finding and processing events emitted from the chaintrap
 * arena diamond.
 */
export class ArenaEvents {
  /**
   * @constructor
   * @param {ethers.Contract |
   *  import("@polysensus/chaintrap-contracts").ERC2535DiamondFacetProxyHandler
   * } arena - the contract instance or diamond proxy
   */
  constructor(arena) {
    /** readonly */
    this.arena = arena;
  }

  async *queryGameEvents(gid, fromBlock) {
    for (const log of await findGameEvents(this.arena, gid, fromBlock)) {
      const iface = this.arena.getEventInterface(log);
      if (!iface) continue;
      const gev = GameEvent.fromParsedEvent(iface.parseLog(log));
      if (!gev) continue;
      yield gev;
    }
  }

  /**
   * Return a GameEvent for the first log matching eventNameOrSignature. Or undefined if none match.
   * @param {ethers.TransactionReceipt} receipt - the receipt for the transaction that will have the log from which to build the event
   * @param {*} receipt
   */
  receiptLog(receipt, eventNameOrSignature) {
    for (const gev of this.receiptLogs(receipt)) {
      if (
        gev?.name === eventNameOrSignature ||
        gev.log.signature === eventNameOrSignature
      )
        return gev;
    }
  }

  /**
   * Return a GameEvent for each logs that is a recognized GameEvent
   * @param {ethers.TransactionReceipt} receipt - the receipt for the transaction that will have the log from which to build the event
   * @param {*} receipt
   * @returns {GameEvent[]}
   */
  receiptLogs(receipt) {
    const gameEvents = [];
    if (receipt.status !== 1) throw new Error("bad receipt status");
    for (const log of receipt.logs) {
      const iface = this.arena.getEventInterface(log);
      if (!iface) continue;
      const gev = GameEvent.fromParsedEvent(iface.parseLog(log));
      if (!gev) continue;
      // yield gev;
      gameEvents.push(gev);
    }
    return gameEvents;
  }
}

export function eventFromCallbackArgs(args) {
  if (args.length === 0) {
    log.info("bad callback from ethers, args empty");
    return;
  }
  return args[args.length - 1];
}

export function parseEthersEvent(iface, txmemo, ev) {
  if (txmemo && txmemo.haveEvent(ev)) {
    log.debug(
      `discarding redundant event. have seen ${ev.transactionHash} before`
    );
    return;
  }

  let parsed;
  try {
    parsed = iface.parseLog(ev);
  } catch (err) {
    log.info("error parsing event from ethers", err);
    return;
  }

  ev.name = parsed.name;
  ev.event = parsed.name;
  ev.signature = parsed.signature;
  ev.args = parsed.args;
  ev.topic = parsed.topic;
  return ev;
}

/**
 * arenaEventFilter is used to monitor any events regardless of gid, typically
 * GameCreated, GameStarted and so on, and specifically _not_ events that are
 * specific to a game
 * @param {string} name
 * @param  {...any} args
 * @returns
 */
export function arenaEventFilter(arena, nameOrSignature, ...args) {
  try {
    return arena.getFilter(nameOrSignature, ...args);
  } catch (e) {
    log.debug(`${e}`);
    throw e;
  }
}

/**
 * gameEventFilter is used when the gid is available
 * @returns
 */
export function gameEventFilter(arena, gid) {
  return {
    address: arena.address,
    topics: [
      null, // any event signature
      ethers.utils.hexZeroPad(ethers.BigNumber.from(gid).toHexString(), 32), // which has the gid as the first topic
    ],
  };
}

export async function findGameCreated(arena, gid) {
  const facet = arena.getFacet("ArenaFacet");
  const filter = facet.filters["GameCreated(uint256,address,uint256)"](gid);
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

export async function findGames(arena) {
  const facet = arena.getFacet("ArenaFacet");
  const filter = facet.filters["GameCreated(uint256,address,uint256)"]();
  return arena.queryFilter(filter);
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
      ethers.utils.hexZeroPad(ethers.BigNumber.from(gid).toHexString(), 32), // which has the game id as the first indexed parameter
    ],
  };
  return arena.queryFilter(filter, fromBlock);
}

/**
 * parseEventLog returns a normalized and (abi) parsed representation of an ethereum event log
 * @template {{topics:[]string, data:string}} LogLike
 * @param {any} iface contract interface (ethers.utils.Interface eg arenaInterface() result)
 * @param {LogLike} ethlog
 * @returns {ethers.utils.LogDescription}
 */
export function parseEventLog(iface, ethlog) {
  // See https://github.com/ethers-io/ethers.js/blob/master/packages/contracts/src.ts/index.ts addContractWait ~#342
  let parsed = null;

  try {
    parsed = iface.parseLog(ethlog);
  } catch (e) {
    log.debug(e);
  }

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

export function playerFromParsedEvent(event) {
  if (typeof event.args.player !== "undefined") {
    return ethers.utils.getAddress(event.args.player); // normalize to checksum addr
  }
  return undefined;
}
