// Collective state tracking for all players registered in a single game

// deps
import { ethers } from "ethers";

// app
import { getLogger } from "./log.js";
//
import { ABIName } from "./abiconst.js";
import { Trialist } from "./trialist.js";
import { findGameEvents, getGameCreatedBlock } from "./arenaevent.js";

export const log = getLogger("StateRoster");

export const fmtev = (e) =>
  `gid: ${e.args.gid}, eid: ${e.args.eid}, ${e.event} bn: ${e.blockNumber}, topics: ${e.topics}, tx: ${e.transactionHash}`;

export async function prepareRoster(arena, options = {}) {
  log.debug(`Arena: ${arena.address} ${options.gid}, ${options}`);

  let { fromBlock } = options;
  let { gid } = options;

  if (typeof gid === "undefined" || gid < 0) {
    gid = await arena.lastGame();
  }

  if (!fromBlock) fromBlock = await getGameCreatedBlock(arena, gid);
  const roster = new StateRoster(gid, options);
  const snap = roster.snapshot();
  return [snap, roster];
}

export async function loadRoster(arena, gid, options) {
  const [snap, roster] = await prepareRoster(arena, gid, options);

  const events = await findGameEvents(arena, gid, options?.fromBlock);
  const gameStates = roster.load(events);
  return [snap, roster, gameStates];
}

/**
 * This class manages a roster of player states for the game.
 *
 * The roster is initially populated by processing all events for a game toked (gid).
 * Subsequently, the roster is updated as each event arrives for that gid.
 * There is no consideration for batched arrival processing once the roster is loaded.
 */
export class StateRoster {
  constructor(gid, options = {}) {
    /**@readonly */
    this.gid = gid;
    /**@readonly */
    this.players = {};
  }

  get playerCount() {
    return Object.keys(this.players).length;
  }

  // --- application of single events
  applyEvent(event) {
    if (typeof event.subject === "undefined") return;

    switch (event.name) {
      case ABIName.TranscriptRegistration:
        this.players[event.subject] = new Trialist();
        break;
    }
    if (!Trialist.handlesEvent(event.name)) return;
    this.players[event.subject].applyEvent(event);
  }

  // --- getters and query methods for managed state
  getPlayer(addr) {
    return this.players[ethers.utils.getAddress(addr)];
  }

  playerState(player) {
    if (!this.players[ethers.utils.getAddress(player)]?.registered) {
      return undefined;
    }
    return this.players[player];
  }
}
