import { ethers } from "ethers";

import { getLogger } from "../log.js";

const logx = getLogger("eventparser");

/**
 * A helper class for finding and processing events emitted from the chaintrap
 * arena diamond.
 */
export class EventParser {
  /**
   * @constructor
   * @param {ethers.Contract |
   *  import("@polysensus/chaintrap-contracts").ERC2535DiamondFacetProxyHandler
   * } contract - the contract instance or diamond proxy
   * @param {eventFactory} - a method which accepts a parsed ethers log instance
   * and creates the event representation expected by the client. defaults to
   * pass through.
   */
  constructor(contract, eventFactory) {
    /** readonly */
    this.contract = contract;
    /** readonly */
    this.eventFactory = eventFactory ?? ((parsed) => parsed);
  }

  /**
   * Parse an ethereum log event using the matching interface on arena. Return
   * undefined if no interface matches the log.
   * @param {ethers.Log} log
   * @returns {ArenaEvent|undefined}
   */
  parse(log) {
    const iface = this.contract.getEventInterface(log);
    if (!iface) return;
    return this.eventFactory(iface.parseLog(log), log);
  }

  /**
   * Return a ArenaEvent for the first log matching eventNameOrSignature. Or undefined if none match.
   * @param {ethers.TransactionReceipt} receipt - the receipt for the transaction that will have the log from which to build the event
   * @param {*} receipt
   */
  receiptLog(receipt, eventNameOrSignature) {
    for (const gev of this.receiptLogs(receipt)) {
      if (
        gev?.name === eventNameOrSignature ||
        gev.parsedLog.signature === eventNameOrSignature
      )
        return gev;
    }
  }

  /**
   * Return a ArenaEvent for each logs that is a recognized ArenaEvent
   * @param {ethers.TransactionReceipt} receipt - the receipt for the transaction that will have the log from which to build the event
   * @param {*} receipt
   * @returns {ArenaEvent[]}
   */
  receiptLogs(receipt) {
    const events = [];
    if (receipt.status !== 1) throw new Error("bad receipt status");
    for (const log of receipt.logs) {
      try {
        const event = this.parse(log);
        if (!event) continue;
        // yield gev;
        events.push(event);
      } catch (err) {
        logx.debug(
          `failed to parse event, this can be benign (the abi may simply not include it): ${err.toString()}`
        );
      }
    }
    return events;
  }
}

export function logFromEthersCallbackArgs(args) {
  if (args.length === 0) {
    log.info("bad callback from ethers, args empty");
    return;
  }
  return args[args.length - 1];
}
