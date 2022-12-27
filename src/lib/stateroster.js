// Collective state tracking for all players registered in a single game

// deps
import { ethers } from "ethers";

// app
import { getLogger } from "./log.js";

import { TxMemo } from "./txmemo.js";
import { ABIName } from "./abiconst.js";
import { Player } from "./player.js";
import { PlayerState } from "./playerstate.js";
import {
  findGameEvents,
  parseEventLog,
  getGameCreatedBlock,
} from "./gameevents.js";

export const log = getLogger("StateRoster");

export const fmtev = (e) =>
  `gid: ${e.args.gid}, eid: ${e.args.eid}, ${e.event} bn: ${e.blockNumber}, topics: ${e.topics}, tx: ${e.transactionHash}`;

export async function prepareRoster(arena, gid, options = {}) {
  log.debug(`Arena: ${arena.address} ${gid}, ${options}`);

  let { fromBlock, model } = options;

  if (typeof gid === "undefined" || gid < 0) {
    gid = await arena.lastGame();
  }

  if (!fromBlock) fromBlock = await getGameCreatedBlock(arena, gid);
  const roster = new StateRoster(arena.interface, gid, options);
  const snap = roster.snapshot();
  return [snap, roster];
}

export async function loadRoster(arena, gid, options) {
  const [snap, roster] = await prepareRoster(arena, gid, options);

  const events = await findGameEvents(arena, gid, options?.fromBlock);
  const gameStates = roster.load(events);
  return [snap, roster, gameStates];
}

export class RosterSnapshot {
  constructor() {
    this.players = {};
  }

  /**
   * Return the snapshot state for the player or return a blank state.
   * Use this to get the 'before' state for delta calculation
   * @param {address} addr
   * @returns
   */
  current(addr) {
    return this.players[addr]?.state ?? new PlayerState();
  }

  set(addr, state) {
    this.players[addr] = state;
  }
}
/**
 * This class manages a roster of player states for the game.
 */
export class StateRoster {
  constructor(arenaInterface, gid, options) {
    const { txmemo, model, hashAlpha } = options;
    // note: if the signer on the contract changes, this will be updated to the
    // new contract instance by the older of the roster
    this.arenaInterface = arenaInterface;
    this.gid = gid;
    this._players = {};
    this._txmemo = txmemo ?? new TxMemo();

    // These are only available when managing state from the perspective of the map owner
    this.model = model;
    this.hashAlpha = hashAlpha;
  }

  get players() {
    return this._players;
  }

  get playerCount() {
    return Object.keys(this._players).length;
  }

  // --- application of single events
  applyParsedEvent(event) {
    // check the event is for the correct game
    if (this._checkEventGid(event) === null) return;

    log.debug(fmtev(event));
    switch (event.event) {
      case ABIName.PlayerJoined:
        return this._playerJoined(event);

      // The caller should detect these if they need an equivelent of gameStates
      // as returned by load()
      case ABIName.GameCreated:
      case ABIName.GameStarted:
      case ABIName.GameCompleted:
        break;
      default: {
        const p = this._checkEventPlayer(event);
        if (p === null) return;

        try {
          p.applyEvent(event, { model: this.model, hashAlpha: this.hashAlpha });
        } catch (e) {
          log.warn(`player applyEvent for ${event.event} raised error`, e);
        }
        return p;
      }
    }
  }

  applyEvent(event) {
    return this.applyParsedEvent(parseEventLog(this.arenaInterface, event));
  }

  // --- batched state updates, used to reduce state thrashing
  snapshot(addresses) {
    const snap = new RosterSnapshot();

    if (typeof addresses === "undefined")
      addresses = Object.keys(this._players);

    for (const addr of addresses) {
      const s = this.snapshotOne(addr);
      if (!s) continue;
      snap.set(addr, s);
    }

    return snap;
  }

  dispatchChanges(snap, dispatcher, addresses) {
    if (typeof addresses === "undefined")
      addresses = Object.keys(this._players);

    for (const addr of addresses) {
      const before = snap.current(addr);
      this.dispatchOne(before, dispatcher, addr);
    }
  }

  getChanges(snap, addresses) {
    if (typeof addresses === "undefined")
      addresses = Object.keys(this._players);

    const changes = [];
    for (const addr of addresses) {
      const before = snap?.players?.[addr]?.state ?? new PlayerState();
      const [_, delta] = this.processOne(before, addr, {
        model: this.model,
        hashAlpha: this.hashAlpha,
      });
      if (!delta) continue;
      changes.push(delta);
    }
    return changes;
  }

  snapshotOne(addr) {
    const p = this._players[addr];
    if (!p) {
      log.debug(`player address ${addr} for snapshot not found`);
      return;
    }
    return p.stateSnapshot();
  }

  dispatchOne(before, dispatcher, addr) {
    const [p, delta] = this.processOne(before, addr);
    if (!delta) return;

    this._dispatchChanges(dispatcher, p, delta);
  }

  processOne(before, addr) {
    const p = this._players[addr];
    if (!p) {
      log.debug(`player address ${addr} for dispatch not found`);
      return;
    }

    p.processPending(p.lastEID, {
      model: this.model,
      hashAlpha: this.hashAlpha,
    });
    if (typeof before === "undefined") return [p, undefined];

    const delta = before.diff(p.state);
    return [p, delta];
  }

  // --- state catchup
  load(events) {
    let addr;

    const gameStates = {};

    // Begin the batch for any we have already.

    for (const ethlog of events) {
      const e = parseEventLog(this.arenaInterface, ethlog);

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
          this._registerPlayer(addr, e);
          break;

        case ABIName.GameCreated:
          gameStates[ABIName.GameCreated] = true;
          break;
        case ABIName.GameStarted:
          gameStates[ABIName.GameStarted] = true;
          break;
        case ABIName.GameCompleted:
          gameStates[ABIName.GameCompleted] = true;
          break;

        default:
          log.debug(fmtev(e));
          this._players[addr].applyEvent(e, {
            model: this.model,
            hashAlpha: this.hashAlpha,
          });
          break;
      }
    }
    return gameStates;
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

  // --- private event handling helpers
  _registerPlayer(addr, event) {
    if (this._players[addr]?.registered) {
      return [undefined, undefined];
    }

    if (this._players[addr] === undefined) {
      log.debug(`_registerPlayer ${addr} ****`);
      const p = new Player();
      p.setState({
        registered: true,
        address: addr,
        profile: event.args.profile,
      });
      this._players[addr] = p;
    }

    return this._players[addr];
  }

  _playerJoined(event) {
    const addr = ethers.utils.getAddress(event.args.player);
    const p = this._registerPlayer(addr, event);
    return p;
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
}
