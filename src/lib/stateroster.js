// Collective state tracking for all players registered in a single game

// deps
import { ethers } from "ethers";

// app
import { getLogger } from "./log.js";
//
import { ABIName2 } from "./abiconst.js";
import { Player } from "./player.js";
import { PlayerState } from "./playerstate.js";
import {
  findGameEvents,
  getGameCreatedBlock,
} from "./arenaevents/arenaevent.js";

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
 * @typedef { import("./arenaevents/arenaevent.js").ArenaEvent } ArenaEvent
 */
export class RosterStateChange {
  constructor() {
    this.players = {};
  }

  captureCurrentState(addresses, roster) {
    this.players = {};

    for (const state of roster.currentStates(addresses)) {
      this.players[addr] = state;
    }
  }

  eventStateUpdate(event, roster, options) {
    const before = this.players[event.subject];
    if (!before) before = new PlayerState();

    const p = roster.players[event.subject];
    if (!p && event.name !== ABIName2.ParticipantRegistered)
      throw new Error(`subject ${event.subject} not registered`);
    p.processPending(p.lastEID);

    return { state: p.state.toObject(), delta: before.diff(p.state) };
  }

  *currentChanges(addresses, roster, options) {
    if (!addresses) addresses = Object.keys(roster.players);

    for (const addr of addresses) {
      const before = this.players[addr]?.state ?? new PlayerState();
      const p = roster.players[addr];
      p.processPending(p.lastEID);
      yield {
        state: p.state.toObject(),
        delta: before.diff(p.state),
      };
    }
  }

  /*
  dispatchChanges(addresses, roster, dispatcher) {
    for (const update of this.currentChanges(addresses, roster)) {
      try {
        dispatcher(update.state, update.delta);
      } catch (e) {
        log.warn(
          `exception dispatching ${Object.keys(update.delta)} for p ${
            update.state.address
          }: ${e}`
        );
      }
    }
  }*/

  /**
   * Return the snapshot state for the player or return a blank state.
   * Use this to get the 'before' state for delta calculation
   * @param {address} addr
   * @returns
   */
  current(addr) {
    return this.players[addr]?.state ?? new PlayerState();
  }
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
    if (typeof event.subject === "undefined")
      return;

    switch (event.name) {
      case ABIName2.ParticipantRegistered:
        this.players[event.subject] = new Player();
        break;
    }
    if (!Player.handlesEvent(event.name))
      return;
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
