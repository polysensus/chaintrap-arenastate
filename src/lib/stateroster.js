// Collective state tracking for all players registered in a single game

// deps
import { ethers } from "ethers";

// app
import { getLogger } from "./log.js";
//
import { ABIName } from "./abiconst.js";
import { TrialistState } from "./trialiststate.js";
import { findGameEvents, getGameCreatedBlock } from "./arenaevent.js";

export const log = getLogger("StateRoster");

export const fmtev = (e) =>
  `gid: ${e.args.gid}, eid: ${e.args.eid}, ${e.event} bn: ${e.blockNumber}, topics: ${e.topics}, tx: ${e.transactionHash}`;

export async function loadRoster(arena, gid, options) {
  log.debug(`Arena: ${arena.address} ${gid}, ${options}`);

  const fromBlock =
    options.fromBlock ?? (await getGameCreatedBlock(arena, gid));

  const events = await findGameEvents(arena, gid, fromBlock);
  const roster = new StateRoster(gid, options);
  for (const event of events) roster.applyEvent(event);
  return roster;
}

/**
 * This class manages a roster of participants states for the game.
 *
 * The roster is initially populated by processing all events for a game toked
 * (gid).  Subsequently, the roster is updated as each event arrives for that
 * gid.  There is no consideration for batched arrival processing once the
 * roster is loaded.
 */
export class StateRoster {
  constructor(gid, options = {}) {
    /**@readonly */
    this.gid = gid;
    /**@readonly */
    this.trialists = {};
  }

  get count() {
    return Object.keys(this.trialists).length;
  }

  // --- application of single events
  applyEvent(event) {
    if (typeof event.subject === "undefined") return;

    switch (event.name) {
      case ABIName.TranscriptRegistration:
        this.trialists[event.subject] = new TrialistState();
        break;
    }
    if (!TrialistState.handlesEvent(event.name)) return;
    this.trialists[event.subject].applyEvent(event);
  }

  // --- getters and query methods for managed state
  trialist(addr) {
    if (!this.trialists[ethers.utils.getAddress(addr)]?.registered)
      return undefined;
    return this.trialists[addr];
  }
}
