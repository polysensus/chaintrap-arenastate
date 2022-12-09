// deps
// app
import { getLogger } from "./log.js";

import { ABIName } from "./abiconst.js";
import { PlayerState } from "./playerstate.js";
const log = getLogger("Player");

export class Player {
  /** clone a new player from the target player t
   *
   * A clone is necessary because changing the signer forces a re construction
   * of the contract interface. which would otherwise force us to rebuild the
   * state. */
  static clone(target) {
    const p = new Player();
    const t = target;

    p.state.update(target.state.toObject());
    p.eids = { ...t.eids };
    // Only need a shallow copy of these
    p.eidsComplete = { ...t.eidsComplete };
    p.useExit = { ...t.useExit };
    p.exitUsed = { ...t.exitUsed };
    p.entryReject = { ...t.entryReject };
    p._batchingUpdate = t._batchingUpdate;
    return p;
  }

  constructor() {
    // transcript state

    this.eids = {};
    // and eid represents a round. a round has two turns. one player turn and
    // one host turn.  when both the player and the host turns have been
    // processed we put them in here so we don't reprocess the host turn
    this.eidsComplete = {};
    this.useExit = {};
    this.exitUsed = {};
    this.entryReject = {};

    this.state = new PlayerState();
  }

  // --- read only external accessors for chain state
  get address() {
    return this.state.address;
  }

  get profile() {
    return this.state.profile;
  }

  get startLocation() {
    return this.state.startLocation;
  }

  get location() {
    return this.state.location;
  }

  get sceneblob() {
    return this.state.sceneblob;
  }

  get side() {
    return this.state.locationIngress[0];
  }

  get locationIngress() {
    return this.state.locationIngress;
  }

  get halted() {
    return this.state.halted;
  }

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

  /**
   * Set any or all of the player properties
   */
  // @ts-ignore
  setState(state) {
    this.state.update(state);
  }

  // --- update methods
  applyEvent(event) {
    if (this._haveEvent(event)) return;

    switch (event.event) {
      case ABIName.PlayerStartLocation:
        return this._addStartLocation(event);
      case ABIName.UseExit:
        return this._addUseExit(event);
      case ABIName.ExitUsed:
        return this._addExitUsed(event);
      case ABIName.EntryReject:
        return this._addEntryReject(event);
      default:
        throw new Error(`Unrecognised event: ${event.event}`);
    }
  }

  /**
   * Process apply events to the player state, starting from the provided eid
   * or apply them all if undefined
   * @param {*} fromEID the eid to start from. undefined forces all
   * @returns
   */
  processPending(fromEID) {
    this.state.pendingExitUsed = false;

    // note: the props are integers, we just get them as strings from Object.keys
    const eids = Object.keys(this.eids)
      .map((i) => Number(i))
      .sort((a, b) => a - b);
    if (eids.length === 0) {
      log.debug("no transcript entries (pending or otherwise)");
      return;
    }

    let istart = 0;
    if (typeof fromEID !== "undefined" && fromEID !== 0) {
      for (; istart < eids.length; istart++) {
        if (eids[istart] === fromEID) {
          // we always re-process the matching eid. as the outcome is on the same eid as the player move
          break;
        }
      }
    } else {
      istart = 0;
    }

    if (istart === eids.length) {
      throw new Error(`${fromEID} not found`);
    }

    for (let i = istart; i < eids.length; i++) {
      const eid = eids[i];
      this.state.lastEID = eid;
      if (this.eidsComplete[eid]) {
        log.debug(`eid ${eid} is complete, continuing`);
        continue;
      }

      const ue = this.useExit[eid];
      const eu = this.exitUsed[eid];
      const er = this.entryReject[eid];

      if (typeof er !== "undefined") {
        // whatever the useExit was it is irrelevant as the host has rejected it.

        this.state.pendingExitUsed = false;

        if (er.halted) {
          /* never 'un halt' */
          this.state.halted = true;
        }
        this.eids[eid] = er.halted;
        log.debug(`${eid} *rejected*`);
        continue;
      }

      if (typeof ue !== "undefined" && typeof eu !== "undefined") {
        this.state.pendingExitUsed = false;

        // ok, we have player exit commitment and we have a corresponding host endorsment
        if (eu.outcome.halt) {
          /* never 'un halt' */
          this.state.halted = true;
        }

        this.state.location = eu.outcome.location;
        this.state.locationIngress = [eu.outcome.side, eu.outcome.ingressIndex];
        this.state.sceneblob = eu.outcome.sceneblob;
        this.eidsComplete[eid] = true;

        log.debug(`${eid} outcome processed`);
        continue;
      }

      if (typeof ue !== "undefined") {
        this.state.pendingExitUsed = true;
        log.debug(`${eid} outcome pending`);
      }
    }
  }

  _addStartLocation(event) {
    // Note: StartLocation is not a transcript event. It sets where the player
    // begins and the host may set it many times before finally starting the
    // game.

    // @ts-ignore
    this.setState({
      location: event.args.startLocation,
      startLocation: event.args.startLocation,
      sceneblob: event.args.sceneblob,
    });
  }

  _addUseExit(event) {
    const eid = Number(event.args.eid);
    if (this.eids[eid]?.transactionHash === event.transactionHash) {
      // log.debug(`duplicate transaction hash, ignoring event: ${event.event}, tx: ${event.transactionHash}`)
      return;
    }

    this.eids[eid] = event;
    this.useExit[eid] = event.args;
  }

  _addExitUsed(event) {
    const eid = Number(event.args.eid);
    this.eids[eid] = event;
    this.exitUsed[eid] = event.args;
  }

  _addEntryReject(event) {
    const eid = Number(event.args.eid);
    this.eids[eid] = event;
    this.entryReject[eid] = event.args;
    this.state.halted = event.args.halted;
  }

  // --- update state control

  // --- private update methods
  _haveEvent(event) {
    let eid = event?.args?.eid;
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
    var isin = []
    for (var i=0; i < eids.length; i++) {
      if (eids[i] in which) {
        isin.push(eids[i])
      }
    }

    if (isin.length === 0) {
      return 0
    }

    return isin[isin.length - 1]
  }

  /** returns the eid of the last committed (which may also have been confrimed) */
  uselast() {
    return this._lastEIDOf(this.useExit)
  }

  /** returns the eid of the last confirmed (which must also have been commited) */
  lastused() {
    return this._lastEIDOf(this.exitUsed)
  }
}