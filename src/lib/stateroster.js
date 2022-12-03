// Collective state tracking for all players registered in a single game

// deps
import { nanoid } from "nanoid";
import { ethers } from "ethers";

// app
import { getLogger } from "./log.js";

import { isUndefined } from "./idioms.js";
import { TxMemo } from "./txmemo.js";
import { ABIName } from "./abiconst.js";
import { Player } from "./player.js";
import { parseEventLog } from "./gameevents.js";

export const log = getLogger("StateRoster");

export const fmtev = (e) =>
  `gid: ${e.args.gid}, eid: ${e.args.eid}, ${e.event} bn: ${e.blockNumber}, topics: ${e.topics}, tx: ${e.transactionHash}`;

/**
 * This class manages a roster of player states for the game.
 */
export class StateRoster {
  constructor(game, gid, dispatcher) {
    this._id = nanoid();
    this._batchingUpdate = false;
    this._batchBefore = undefined;

    // note: if the signer on the contract changes, this will be updated to the
    // new contract instance by the older of the roster
    this.game = game;
    this.gid = gid;
    this.dispatcher = dispatcher;
    this._players = {};
    this._txmemo = new TxMemo();
  }

  _haveSeenEvent(e) {
    return this._txmemo.haveEventTx(e);
  }

  _eventMemo(e) {
    try {
      return this._txmemo.eventTxMemo(e);
    } catch (err) {
      log.debug(err, this._txmemo._recentTx);
      return false;
    }
  }

  get arena() {
    return this.game.arena;
  }

  get players() {
    return this._players;
  }

  // --- live state updates (not batched)

  // these are typically live event subscriptions comming in as they happen. All
  // we are doing with theese is ensuring we don't emmit redundant or duplicate
  // events. These methods are all named after the game contract events they
  // deal with.

  async applyEvent(event) {
    event = parseEventLog(event);
    log.debug(fmtev(event));
    switch (event.event) {
      case ABIName.PlayerJoined:
        return await this._playerJoined(event);
      default: {
        this._withConditionalDispatch(event);
      }
    }
  }

  async _playerJoined(event) {
    // check the event is for the correct game
    if (this._checkEventGid(event) === null) return;

    const addr = ethers.utils.getAddress(event.args.player);
    const [p, update] = this._registerPlayer(addr, event);
    if (!update) return;

    this._withConditionalDispatchStateDelta(p, () => {
      p.setState(update);
    });
  }

  _withConditionalDispatch(event) {
    if (this._checkEventGid(event) === null) return;

    const p = this._checkEventPlayer(event);
    if (p === null) return;

    let delta;
    try {
      delta = p.appleyEvent(event);
    } catch (e) {
      log.warn(
        `player applyEvent for ${event.event} raised error: ${JSON.stringify(
          e
        )}`
      );
      return;
    }

    if (isUndefined(delta)) return;

    if (this._batchingUpdate) return;

    if (isUndefined(delta))
      log.debug(`undefined delta for event ${event.event}`);
    this._dispatchChanges(this.dispatcher, p, delta);
  }

  _withConditionalDispatchStateDelta(p, applyState) {
    let before;
    if (!this._batchingUpdate) {
      before = p.stateSnapshot();
    }

    try {
      applyState();
    } catch (e) {
      log.warn(`applyState raised error: ${JSON.stringify(e)}`);
      return;
    }

    if (!this._batchingUpdate) {
      this._dispatchChanges(
        this.dispatcher,
        p,
        p.stateDelta(before, p.stateSnapshot())
      );
    }
  }

  _checkEventPlayer(event) {
    let addr = event?.args?.player;
    if (addr === null) {
      log.debug(`event ${event.event} doesn't include player address`);
      return null;
    }

    addr = ethers.utils.getAddress(addr);

    const p = this._players[addr];

    if (typeof p === "undefined") {
      log.debug(
        `event ${event.event} address ${addr} is not a registered player`
      );
      return null;
    }

    return p;
  }

  _checkEventGid(event) {
    let gid = event.args.gid;
    if (!ethers.BigNumber.isBigNumber(gid)) {
      gid = ethers.BigNumber.from(gid);
    }
    if (!gid.eq(this.gid)) {
      log.debug(
        `event ${
          event.event
        } for other game ${gid.toHexString()}, this.gid: ${this.gid.toHexString()}`
      );
      return null;
    }
    return gid;
  }

  // --- state catchup batched update and reconciliation
  // typically done once on page load

  /** batchedUpdateBegin initialised a starting point for a batch of updates At
   * the end of the batch only the diff of the state changed for each player for
   * the relevant states is dispatched to the listeners.
   *
   * As the caller cant control when it gets notifications from ethers js and the
   * chain. So they can't guarantee 'only once' semantics. So begin needs to
   * be idempotent.
   */
  batchedUpdateBegin() {
    if (this._batchingUpdate) {
      log.debug("batch already open, considering adding players to batch");
      for (const [addr, p] of Object.entries(this._players)) {
        if (!isUndefined(this._batchBefore[addr])) continue;
        log.debug(`Adding player ${addr} to batch`);
        p.batchedUpdateBegin();
        this._batchBefore[addr] = p.stateSnapshot();
      }
      return;
    }

    log.info(`
    ***
    * BeginBatch roster: ${this._id}
    `);
    this._batchingUpdate = true;
    this._batchBefore = {};
    for (const [addr, p] of Object.entries(this._players)) {
      p.batchedUpdateBegin();
      this._batchBefore[addr] = p.stateSnapshot();
    }
  }

  batchedUpdateFinalize() {
    if (!this._batchingUpdate) {
      // because batchedUpdateBegin accumulates multiple calls into one 'open'
      // we simply return if there is no currently open batch
      log.debug(`batch already finalized roster: ${this._id}`);
      return;
    }

    log.info(`
    * EndBatch roster: ${this._id}
    ***
    `);

    for (const [addr, p] of Object.entries(this._players)) {
      const delta = p.batchedUpdateFinalize(this._batchBefore[addr]);
      this._dispatchChanges(this.dispatcher, p, delta);
    }
    this._batchingUpdate = false;
    this._batchBefore = undefined;
  }

  async load(events) {
    let addr;

    // Begin the batch for any we have already.

    for (const ethlog of events) {
      const e = parseEventLog(this.game, ethlog);

      if (typeof e.args.player !== "undefined") {
        addr = ethers.utils.getAddress(e.args.player); // normalize to checksum addr
      }

      if (this._eventMemo(e)) {
        log.debug(`event known, ignoring ${e.transactionHash}`);
        continue;
      }
      log.debug(fmtev(e));

      switch (e.event) {
        case ABIName.PlayerJoined:
          // const chainstate = await this.game.playerByAddress(addr);
          const [p, update] = this._registerPlayer(addr, e);
          if (!update) break;

          this._players[addr].setState(update);
          break;

        case ABIName.GameCreated:
        case ABIName.GameStarted:
        case ABIName.GameCompleted:
          break;

        default:
          log.debug(fmtev(e));
          this._players[addr].applyEvent(e);
          break;
      }
    }
  }

  _registerPlayer(addr, event) {
    if (this._players[addr]?.registered) {
      return [undefined, undefined];
    }

    if (this._players[addr] === undefined) {
      this._players[addr] = new Player();
    }

    const p = this._players[addr];

    // begin the batch for the newly registered player
    if (this._batchingUpdate) {
      p.batchedUpdateBegin();
      this._batchBefore[addr] = p.stateSnapshot();
    }

    return [
      p,
      {
        registered: true,
        address: addr,
        profile: event.args.profile,
      },
    ];
  }

  // --- getters and query methods for managed state
  playerState(player) {
    player = ethers.utils.getAddress(player); // normalize to checksum addr
    return this._playerState(player);
  }

  playerRegistered(player) {
    player = ethers.utils.getAddress(player); // normalize to checksum addr
    return this._playerRegistered(player);
  }

  getPlayer(addr) {
    return this._getPlayer(ethers.utils.getAddress(addr));
  }

  // --- misc private helpers
  _dispatchChanges(dispatcher, player, delta) {
    try {
      dispatcher(player, delta);
    } catch (e) {
      log.warn(
        `exception dispatching ${Object.keys(delta)} for p ${
          player.address
        }: ${e}`
      );
    }
  }

  _playerState(player) {
    if (!this._players[player]?.registered) {
      return undefined;
    }
    return this._players[player];
  }

  _playerRegistered(player) {
    const p = this._playerState(player);
    if (typeof p === "undefined") {
      return false;
    }
    return true;
  }

  _getPlayer(addr) {
    const p = this._players[addr];
    if (!p) {
      log.debug(`no player state for player address ${addr}`);
      return;
    }
    return p;
  }
}
