import { ABIName } from "./abiconst.js";
import { undefinedIfZeroBytesLike } from "./chainkit/ethutil.js";

import { PropDelta } from "./propdelta.js";

export const TrialistEvents = Object.fromEntries([
  [ABIName.TranscriptRegistration, true],
  [ABIName.TranscriptParticipantHalted, true],
  [ABIName.TranscriptEntryChoices, true],
  [ABIName.TranscriptEntryCommitted, true],
  [ABIName.TranscriptEntryOutcome, true],
]);

function maxKey(o) {
  let max = -1;
  for (let k of Object.keys(o)) {
    k = Number(k);
    if (k > max) max = k;
  }
  return max === -1 ? undefined : max;
}

export class TrialistState {
  static handlesEvent(name) {
    return TrialistEvents[name];
  }

  constructor(address) {
    this.address = address;
    this.propDelta = new PropDelta(
      [
        "registered",
        "halted",
        "address",
        "profile",
        "rootLabel",
        "inputChoice",
        "location",
        "choices",
        "scene",
        "data",
        "lastEID",
      ],
      {
        profile: (profile) => undefinedIfZeroBytesLike(profile),
        data: (data) => undefinedIfZeroBytesLike(data),
      }
    );

    this.state = {};
    this._previous = {};
    this._delta = {};

    this.eids = {};

    /**
     * @readonly
     * accumulation of updates for each eid
     */
    this._entryDelta = {};

    /**
     * @readonly
     * These events can all share an eid so must be stored separately. Also,
     * TranscriptEntryOutcome is only valid if we already have an TranscriptEntryCommitted
     */
    this.eventsByABI = Object.fromEntries(
      Object.keys(TrialistEvents).map((abiName) => [abiName, {}])
    );
  }

  // --- read only external accessors for chain state
  get lastEID() {
    if (typeof this.state.lastEID === "undefined") return 0;
    return Number(this.state.lastEID);
  }

  get started() {
    return (
      typeof this.state.lastEID !== "undefined" || this.state.pendingExitUsed
    );
  }

  maxEventEID(name) {
    return maxKey(this.eventsByABI);
  }

  pendingOutcome(eid) {
    // get the greatest committed eid
    if (typeof eid === "undefined") eid = this.last();
    // if it hasn't been committed, its definitely not pending.
    if (!this.eventsByABI[ABIName.TranscriptEntryCommitted][eid]) return false;
    // If its committed and the outcome isn't recorded, then its definitely pending
    if (!this.eventsByABI[ABIName.TranscriptEntryOutcome][eid]) return true;

    // definitely not pending.
    return false;
  }

  // --- direct change method (these don't require updateBegin)

  // --- update methods
  applyEvent(event, options = {}) {
    const eventID = `${event.name}:${event.log.transactionHash}`;
    if (event.subject !== this.address)
      throw Error(
        `event subject address inconsistent got ${event.subject}, expected ${this.address}`
      );

    // eid will be zero in startTranscript
    const eid = Number(event.eid ?? 0);
    if (this.eids[eid]?.[eventID]) return;

    if (eid in this.eventsByABI[event.name])
      throw new Error(
        `Duplicate processing attempt for event ${event.name} eid ${eid}`
      );

    // We want to check this before modifying any state. checks -> effects -> interactions
    if (event.name === ABIName.TranscriptEntryOutcome)
      if (!this.eventsByABI[ABIName.TranscriptEntryCommitted][eid])
        throw new Error(
          `commitment not found for outcome with eid ${event.eid}`
        );

    if (this.eids[eid]) this.eids[eid][eventID] = event;
    else this.eids[eid] = Object.fromEntries([[eventID, event]]);

    if (event.update) {
      const delta = this.propDelta.delta(this.state, event.update);
      Object.assign(this.state, delta);
      // delta accumulates forever until collected. It is the delta since the last collection.
      Object.assign(this._delta, delta);
      this._entryDelta[eid] = { ...delta };
    }

    this.eventsByABI[event.name][eid] = event;
  }

  delta(options) {
    const delta = { ...this._delta };
    if (options?.collect) {
      this._previous = { ...this.state };
      this._delta = {};
    }
    return delta;
  }

  current() {
    return { ...this.state };
  }

  entryDelta(options) {
    const which = options?.eid ?? this.last();
    if (!(which in this._entryDelta))
      throw new Error(`eid ${which} not in _entryDelta`);
    return { ...this._entryDelta[which] };
  }

  // --- private update methods

  ordered(options) {
    let map = options?.abiName ? this.eventsByABI[options.abiName] : this.eids;
    return Object.keys(map)
      .map((v) => Number(v))
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
