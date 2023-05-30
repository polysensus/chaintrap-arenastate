import { ethers } from "ethers";
const arrayify = ethers.utils.arrayify;
import * as msgpack from "@msgpack/msgpack";

import {
  isV1GameEvent as isV1ArenaEvent,
  isV2GameEvent as isV2ArenaEvent,
  ABIName2,
} from "../abiconst.js";

import { EventParser } from "./eventparser.js";

export class ArenaEventParser extends EventParser {
  constructor(contract) {
    super(contract, ArenaEvent.fromParsedEvent);
  }
}

/**
 * ArenaEvent is a normalized wrapper for all chaintrap contract events which
 * affect game state. Supports v1 "tracing paper" game events, and v2 merkle
 * argument events.
 *
 * @template {{
 *  id:ethers.BigNumber,
 *  subject?,
 *  advocate?,
 *  data?,
 *  rootLabel:string,
 *  log:ethers.utils.LogDescription
 * }} ParsedGameLogLike
 */
export class ArenaEvent {
  /**
   * @constructor
   * @param {ParsedGameLogLike} parsed parsed and normalized game event
   */
  constructor(parsed) {
    Object.assign(this, parsed);
  }

  /**
   * @template {{args, blockNumber, data, topics, transactionHash, transactionIndex}} ParsedLogLike
   * @param {ParsedLogLike} parsedLog ethers event, parsed according to the contract ABI.
   */
  static fromParsedEvent(parsedLog, log) {
    const arenaEvent = {
      // Note: until we clear out the old events we need the ??
      gid: parsedLog.args.id ?? parsedLog.args.gid,
      name: parsedLog.name,
      parsedLog,
      log,
      subject: undefined,
      // update is populated if there is a subject, and if the event carries an
      // update for that subject
      update: {},
    };
    switch (parsedLog.name) {
      case ABIName2.GameCreated:
        arenaEvent.subject = parsedLog.args.creator;
        break;
      case ABIName2.GameStarted:
        break;
      case ABIName2.GameCompleted:
        break;
      case ABIName2.ParticipantRegistered:
        arenaEvent.subject = parsedLog.args.participant;
        arenaEvent.update = {
          address: parsedLog.args.participant,
          registered: true,
          profile: msgpack.decode(arrayify(parsedLog.args.profile)),
        };
        break;
      case ABIName2.RevealedChoices:
        arenaEvent.subject = parsedLog.args.participant;
        arenaEvent.eid = parsedLog.args.eid;
        arenaEvent.update = {
          choices: parsedLog.args.choices,
          scene: msgpack.decode(arrayify(parsedLog.args.data)),
        };
        break;

      case ABIName2.ActionCommitted:
        arenaEvent.eid = parsedLog.args.eid;
        arenaEvent.subject = parsedLog.args.participant;
        arenaEvent.update = {
          lastEID: arenaEvent.eid,
          rootLabel: parsedLog.args.rootLabel,
          outcome: parsedLog.args.outcome,
          node: parsedLog.args.node,
          data: parsedLog.args.data,
        };
        break;
      case ABIName2.ArgumentProven:
        arenaEvent.eid = parsedLog.args.eid;
        arenaEvent.subject = parsedLog.args.participant;
        arenaEvent.advocate = parsedLog.args.advocate;
        arenaEvent.update = {};
        break;
      case ABIName2.OutcomeResolved:
        arenaEvent.eid = parsedLog.args.eid;
        arenaEvent.subject = parsedLog.args.participant;
        arenaEvent.advocate = parsedLog.args.advocate;
        arenaEvent.update = {
          rootLabel: parsedLog.args.rootLabel,
          outcome: parsedLog.args.outcome,
          node: parsedLog.args.node,
          // The scene is left to RevealedChoices
          // data: ev.args.data,
          // scene: msgpack.decode(arrayify(ev.args.data))
        };
        break;
      /*
      default:
        throw new Error(`event ${ev.name} with signature ${ev.signature} not recognized for ABIv2`);
        */
    }
    return new ArenaEvent(arenaEvent);
  }
}

/**
 * arenaEventFilter is used to monitor any events regardless of gid, typically
 * GameCreated, GameStarted and so on, and specifically _not_ events that are
 * specific to a game
 * @param {string} name
 * @param  {...any} args
 * @returns
 */
export function arenaEventFilter(arena, nameOrSignature, ...args) {
  try {
    return arena.getFilter(nameOrSignature, ...args);
  } catch (e) {
    log.debug(`${e}`);
    throw e;
  }
}

/**
 * gameEventFilter is used when the gid is available
 * @returns
 */
export function gameEventFilter(arena, gid) {
  return {
    address: arena.address,
    topics: [
      null, // any event signature
      ethers.utils.hexZeroPad(ethers.BigNumber.from(gid).toHexString(), 32), // which has the gid as the first topic
    ],
  };
}

export async function findGameCreated(arena, gid) {
  const facet = arena.getFacet("ArenaFacet");
  const filter = facet.filters["GameCreated(uint256,address,uint256)"](gid);
  const found = await arena.queryFilter(filter);

  if (found.length == 0) {
    log.warn("error: game not found");
    return undefined;
  }
  if (found.length > 1) {
    throw Error(`duplicate GameCreated events for gid: ${gid}`);
  }

  return found[0];
}

export async function findGames(arena) {
  const facet = arena.getFacet("ArenaFacet");
  const filter = facet.filters["GameCreated(uint256,address,uint256)"]();
  return arena.queryFilter(filter);
}

export async function getGameCreatedBlock(arena, gid) {
  return (await findGameCreated(arena, gid)).blockNumber;
}

/**
 * findGameEvents finds all events for the game. Returning them in the order
 * they were recorded on chain.
 *
 * To limit the events considered, provide fromBlock as the first positional
 * parameter.
 */
export async function findGameEvents(arena, gid, fromBlock) {
  const filter = {
    address: arena.address,
    topics: [
      null, // any event on the contract
      ethers.utils.hexZeroPad(ethers.BigNumber.from(gid).toHexString(), 32), // which has the game id as the first indexed parameter
    ],
  };
  return arena.queryFilter(filter, fromBlock);
}
