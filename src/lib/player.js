
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
    this._previous = {};
    this._delta = {};

    this.eids = {};

    /**
     * @readonly
     * The state after applying the update in the commit for the corresponding
     * eid. The start state is always eid 0
     */
    this.outcomeStates = {};
    /**
     * @readonly
     * The delta from the previously committed state to the most recently
     * committed state. The previously committed state for the first commit is
     * the state when RevealedChoices from startGame is applied.
     */
    this.outcomeDelta = {};

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

    const eventID = `${event.name}:${event.log.transactionHash}`;

    // eid will be zero in startGame
    const eid = Number(event.eid ?? 0);
    if (this.eids[eid]?.[eventID])
      return;

    if (eid in this.eventsByABI[event.name])
      throw new Error(`Duplicate processing attempt for event ${event.name} eid ${eid}`);

    // We want to check this before modifying any state. checks -> effects -> interactions
    if (event.name === ABIName2.OutcomeResolved)
      if (!this.eventsByABI[ABIName2.ActionCommitted][eid])
        throw new Error(`commitment not found for outcome with eid ${event.eid}`);

    if (this.eids[eid])
      this.eids[eid][eventID] = event;
    else
      this.eids[eid] = Object.fromEntries([[eventID, event]]);


    if (event.update) {

      const delta = PlayerState.delta(this.state, event.update);
      Object.assign(this.state, delta);
      // delta accumulates forever until collected. It is the delta since the last collection.
      Object.assign(this._delta, delta);
    }

    switch (event.name) {

      case ABIName2.OutcomeResolved: {

        const lastOutcomeEID = this.last({abiName:ABIName2.OutcomeResolved, n:1})
        const lastOutcomeState = this.outcomeStates[lastOutcomeEID];

        // Also, automatically provide delta's for each outcome event (Accepted, Rejected or otherwise)
        this.outcomeDelta[eid] = PlayerState.delta(lastOutcomeState, this.state);
        this.outcomeStates[eid] = {...this.state};
        break;
      }

    case ABIName2.RevealedChoices: {
      if (eid !== 0)
        break;

        // Deal with startGame, which emits RevealedChoices to set the starting
        // scene. This delta will include the player registration and profile
        this.outcomeDelta[eid] = {...this.state}
        this.outcomeStates[eid] = {...this.state}
        break;
      }
    }

    this.eventsByABI[event.name][eid] = event;
  }

  delta(options) {
    const delta = {...this._delta};
    if (options?.collect) {
      this._previous = {...this.state};
      this._delta = {};
    }
    return delta;
  }

  current() {
    return {...this.state}
  }

  outcome(options) {
    const which = options?.eid ?? this.last({abiName:ABIName2.OutcomeResolved})
    if (options?.delta) {
      if (!(which in this.outcomeDelta))
        throw new Error(`eid ${which} not in outcomeDelta`);
      return {...this.outcomeDelta[which]};
    }
      if (!(which in this.outcomeStates))
        throw new Error(`eid ${which} not in outcomeStates`);
    return {...this.outcomeStates[which]};
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
    // log.debug(`duplicate transaction hash, ignoring event: ${event.name}, tx: ${event.log.transactionHash}`)
    return true;
  }

  ordered(options) {
    let map = options?.abiName ? this.eventsByABI[options.abiName] : this.eids;
    return Object.keys(map)
      .map(v=>Number(v))
      .sort((a, b) => a - b);
  }

  /** return the last known eid.
   * @param {{abiName, n}} options - abiName selects a particular event, n sets the 
  */
  last(options) {

    const eids = this.ordered(options);
    if (eids.length === 0) return 0; // eid zero is reserved by the contracts
    return eids[eids.length - (options?.n ?? 1)];
  }
}
