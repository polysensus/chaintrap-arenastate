
import ethers from "ethers";

import { getLogger } from "./log.js";

import { ABIName2 } from "./abiconst.js";
import { PlayerState } from "./playerstate.js";

export const PlayerEvents = Object.fromEntries([
  [ABIName2.ParticipantRegistered, true],
  [ABIName2.RevealedChoices, true],
  [ABIName2.ActionCommitted, true],
  [ABIName2.OutcomeResolved, true]
]);

export class Player {

  static handlesEvent(name) {
    return PlayerEvents[name]
  }

  constructor() {

    this.state = {};
    this.previous = {};
    this.delta = {};

    this.eids = {};

    /**
     * @readonly
     * The state after applying the update in the commit for the corresponding
     * eid. The start state is always eid 0
     */
    this.committedStates = {};
    /**
     * @readonly
     * The delta from the previously committed state to the most recently
     * committed state. The previously committed state for the first commit is
     * the state when RevealedChoices from startGame is applied.
     */
    this.commitDelta = {};

    /**
     * @readonly
     * These events can all share an eid so must be stored separately. Also,
     * OutcomeResolved is only valid if we already have an ActionCommitted
     */
    this.eventsByABI = Object.fromEntries(
      Object.keys(PlayerEvents).map(abiName => [abiName, {}])
    );
  }

  // --- read only external accessors for chain state
  get lastEID() {
    if (typeof this.state.lastEID === "undefined") return 0;
    return this.state.lastEID;
  }

  get started() {
    return (
      typeof this.state.lastEID !== "undefined" || this.state.pendingExitUsed
    );
  }

  // --- direct change method (these don't require updateBegin)

  // --- update methods
  applyEvent(event, options = {}) {

    // eid will be zero in startGame
    const eid = Number(event.eid ?? 0);
    if (this.eids[eid]?.[event.log.transactionHash])
      return;

    if (eid in this.eventsByABI[event.name])
      throw new Error(`Duplicate processing attempt for event ${event.name} eid ${eid}`);

    // We want to check this before modifying any state. checks -> effects -> interactions
    if (event.event === ABIName2.OutcomeResolved)
      if (!this.eventsByABI[ABIName2.ActionCommitted][eid])
        throw new Error(`commitment not found for outcome with eid ${event.eid}`);

    if (this.eids[eid])
      this.eids[eid][event.log.transactionHash] = event;
    else
      this.eids[eid] = Object.fromEntries([[event.log.transactionHash, event]]);


    if (event.update) {

      const delta = PlayerState.delta(this.state, event.update);
      Object.assign(this.state, delta);
      // delta accumulates forever until collected. It is the delta since the last collection.
      Object.assign(this.delta, delta);

      if (event.event === ABIName2.OutcomeResolved) {

        const lastOutcomeEID = this.last({abiName:ABIName2.OutcomeResolved, n:1})
        const lastOutcomeState = this.committedStates[lastOutcomeEID];

        // Also, automatically provide delta's for each outcome event (Accepted, Rejected or otherwise)
        this.commitDelta[eid] = PlayerState.delta(lastOutcomeState, this.state);
        this.committedStates[eid] = {...this.state};
      }
    }

    if (event.event === ABIName2.RevealedChoices && eid === 0) {
      // Deal with startGame, which emits RevealedChoices to set the starting
      // scene. This delta will include the player registration and profile
      this.commitDelta[eid] = {...this.state}
      this.committedStates[eid] = {...this.state}
    }

    this.eventsByABI[event.name][eid] = event;
  }

  collectDelta() {
    this.previous = {...this.state};
    const delta = {...this.delta};
    this.delta = {};
    return delta;
  }

  // --- update state control

  // --- private update methods
  _haveEvent(event) {
    let eid = event?.eid;
    if (!eid) {
      return false;
    }
    eid = Number(eid);

    if (this.eids[eid]?.log.transactionHash !== event.log.transactionHash) {
      return false;
    }
    // log.debug(`duplicate transaction hash, ignoring event: ${event.event}, tx: ${event.log.transactionHash}`)
    return true;
  }

  ordered(options) {
    let map = options?.abiName ? this.eventsByABI[options.abiName] : this.eids;
    return Object.keys(map)
      .sort((a, b) => a - b);
  }

  /** return the last known eid.
   * @param {{abiName, n}} options - abiName selects a particular event, n sets the 
  */
  last(options) {

    const eids = this.ordered(options);
    if (eids.length === 0) return 0; // eid zero is reserved by the contracts
    return eids[eids.length - options?.n ?? 1];
  }
}
