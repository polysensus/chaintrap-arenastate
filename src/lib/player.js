// app
import { getLogger } from "./log.js";

import { ABIName2 } from "./abiconst.js";
import { PlayerState } from "./playerstate.js";
const log = getLogger("Player");

export class Player {
  constructor() {
    this.eids = {};
    /**@readonly
     * The player or host may commit to actions
     */
    this.committedActions = {};
    /**@readonly
     * A participant, typically the guardian or an advocate for the guardian,
     * proposes an outcome proof.
     */
    this.proposedOutcomes = {};

    /**@readonly
     * The contract emitted OutcomeResolved event data for the proposed outcome
     */
    this.resolvedOutcomes = {};
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
    if (this._haveEvent(event)) return;

    const currentState = this.state.toObject();
    const stateUpdate = {};

    switch (event.event) {
      case ABIName2.ActionCommitted: {
        if (this.eidIsKnown(event.eid))
          throw new Error(
            `event for eid ${event.eid} is already pending or committed`
          );

        const eventData = EventData.decode(event.data);
        this.committedActions[event.eid] = event;
        stateUpdate.rootLabel = event.rootLabel;
        stateUpdate.pendingOutcomeType = eventData.type;
        break;
      }

      case ABIName2.OutcomeResolved: {
        if (!this.eidHasProposal(event.eid))
          throw new Error(`proposal not found for eid ${event.eid}`);

        const eventData = EventData.decode(event.data);
        const { outcome, update } = options.dungeon.outcomeResolved(
          this.state.toObject(),
          this.proposedOutcomes[event.eid],
          eventData
        );
        stateUpdate = { ...stateUpdate, ...update };
        this.resolvedOutcomes[event.eid] = outcome;
        break;
      }
    }
    this.state.update(stateUpdate);
  }

  eidIsKnown(eid) {
    return (
      !!this.committedActions[eid] ||
      !!this.proposedOutcomes[eid] ||
      !!this.resolvedOutcomes[eid]
    );
  }

  eidHasProposal(eid) {
    return (
      !!this.committedActions[eid] &&
      !!this.proposedOutcomes[eid] &&
      !!!this.resolvedOutcomes[eid]
    );
  }

  // --- update state control

  // --- private update methods
  _haveEvent(event) {
    let eid = event?.eid;
    if (!eid) {
      return false;
    }
    eid = Number(eid);

    if (this.eids[eid]?.transactionHash !== event.transactionHash) {
      return false;
    }
    // log.debug(`duplicate transaction hash, ignoring event: ${event.event}, tx: ${event.transactionHash}`)
    return true;
  }

  /**
   * Capture the values of all instance variables that we want to signal changes for.
   * Especially for batched updates, we only want to signal one change per update.
   * And if a value changes from A -> B -> A we do NOT signal an update
   * @returns
   */
  stateSnapshot() {
    return this.state.clone();
  }

  stateDelta(before, after) {
    return new PlayerState().update(before.diff(after));
  }

  ordered() {
    return Object.keys(this.eids)
      .map((i) => Number(i))
      .sort((a, b) => a - b);
  }

  /** return the last eid. computes based on contents of known eids rather than relying on lastEID */
  last() {
    const eids = this.ordered();
    if (eids.length === 0) return 0; // eid zero is reserved by the contracts
    return eids[eids.length - 1];
  }

  _lastEIDOf(which) {
    const eids = this.ordered();

    // Note that eid zero is reserved in the contracts
    var isin = [];
    for (var i = 0; i < eids.length; i++) {
      if (eids[i] in which) {
        isin.push(eids[i]);
      }
    }

    if (isin.length === 0) {
      return 0;
    }

    return isin[isin.length - 1];
  }
}
