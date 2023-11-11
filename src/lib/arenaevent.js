import { ethers } from "ethers";
const arrayify = ethers.utils.arrayify;
import * as msgpack from "@msgpack/msgpack";

import { ABIName } from "./abiconst.js";
import { transcriptEventFilter, transcriptEventSig } from "./arenaabi.js";

import { EventParser } from "./chainkit/eventparser.js";

import { undefinedIfZeroBytesLike } from "./chainkit/ethutil.js";

import { LocationChoices } from "./maptrie/locationchoices.js";
import { IPFSScheme } from "./chainkit/nftstorage.js";
import { isUndefined, awaitable } from "./idioms.js";

export const ERC1155URISignature = "URI(string,uint256)";

/**
 *
 * @param {EventParser} eventParser
 * @returns {ArenaEvent}
 */
export function getGameCreated(receipt, eventParser) {
  return eventParser.receiptLog(
    receipt,
    transcriptEventSig(ABIName.TranscriptCreated)
  );
}

export function getSetMerkleRoot(receipt, eventParser) {
  return eventParser.receiptLog(
    receipt,
    transcriptEventSig(ABIName.TranscriptMerkleRootSet)
  );
}

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
      case "TransferSingle":
        break;
      case "URI":
        arenaEvent.gid = parsedLog.args.tokenId;
        break;
      case ABIName.TranscriptCreated:
        arenaEvent.subject = parsedLog.args.creator;
        break;
      case ABIName.TranscriptStarted:
        break;
      case ABIName.TranscriptCompleted:
        break;
      case ABIName.TranscriptRegistration:
        arenaEvent.subject = parsedLog.args.participant;
        arenaEvent.update = {
          address: parsedLog.args.participant,
          registered: true,
          profile: msgpack.decode(arrayify(parsedLog.args.profile)),
        };
        break;
      case ABIName.TranscriptParticipantHalted:
        arenaEvent.subject = parsedLog.args.participant;
        arenaEvent.update = {
          halted: true,
        };
        break;

      case ABIName.TranscriptEntryChoices:
        arenaEvent.subject = parsedLog.args.participant;
        arenaEvent.eid = parsedLog.args.eid;
        arenaEvent.update = {
          location:
            parsedLog.args.choices.inputs[LocationChoices.LOCATION_INPUT],
          choices: parsedLog.args.choices.inputs.slice(
            LocationChoices.CHOICE_INPUTS
          ),
        };
        const data = undefinedIfZeroBytesLike(parsedLog.args.data);
        if (data) arenaEvent.update.scene = msgpack.decode(arrayify(data));

        break;

      case ABIName.TranscriptEntryCommitted:
        arenaEvent.eid = parsedLog.args.eid;
        arenaEvent.subject = parsedLog.args.participant;
        arenaEvent.update = {
          lastEID: arenaEvent.eid,
          rootLabel: parsedLog.args.rootLabel,
          // We trim the location input in TranscriptEntryChoice (above), so we
          // need to account for that here when we get the inputChoice - it is
          // _not_ adjusted at the contracts level.
          inputChoice:
            Number(parsedLog.args.inputChoice) - LocationChoices.CHOICE_INPUTS,
          data: parsedLog.args.data,
        };
        break;
      case ABIName.TranscriptEntryOutcome:
        arenaEvent.eid = parsedLog.args.eid;
        arenaEvent.subject = parsedLog.args.participant;
        arenaEvent.advocate = parsedLog.args.advocate;
        arenaEvent.update = {
          rootLabel: parsedLog.args.rootLabel,
          outcome: parsedLog.args.outcome,
          // The scene is left to TranscriptEntryChoices
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
 * TranscriptCreated, TranscriptStarted and so on, and specifically _not_ events that are
 * specific to a game
 * @param {string} name
 * @param  {...any} args
 * @returns
 */
export function arenaEventFilter(arena, nameOrSignature, ...args) {
  try {
    return arena.getFilter(nameOrSignature, ...args);
  } catch (e) {
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

export async function findTranscriptEvent(arena, gid, abiName, options = {}) {
  const filter = transcriptEventFilter(arena, abiName, gid);
  const found = await arena.queryFilter(filter);

  if (found.length == 0) {
    return options?.unique ? undefined : [];
  }
  if (found.length > 1 && options?.unique) {
    throw Error(`duplicate TranscriptCreated events for gid: ${gid}`);
  }

  return options?.unique ? found[0] : found;
}

export async function findGameCreated(arena, gid) {
  return await findTranscriptEvent(arena, gid, ABIName.TranscriptCreated, {
    unique: true,
  });
}

export async function findGameCompleted(arena, gid) {
  return await findTranscriptEvent(arena, gid, ABIName.TranscriptCompleted, {
    unique: true,
  });
}

export async function findGameMetadata(arena, gid) {
  const createdLog = await findGameCreated(arena, gid);
  if (!createdLog) return undefined;

  const r = await createdLog.getTransactionReceipt();
  for (const log of r.logs) {
    const iface = arena.getEventInterface(log);
    const parsedLog = iface.parseLog(log);
    if (parsedLog.signature !== ERC1155URISignature) continue;

    const uri = parsedLog.args.value;
    if (!uri.startsWith(IPFSScheme))
      throw new Error(`metadata url is not a valid ipfs reference`);
    return uri;
  }
  throw new Error(`metadata url not set when the game was created`);
}

export async function findGames(arena) {
  const filter = transcriptEventFilter(arena, ABIName.TranscriptCreated);
  return arena.queryFilter(filter);
}

/**
 * Find trials matching the provided filter
 * @param {any} eventParser
 * @param {filter} filter (contract, event)
 * @param {number} limit
 * @returns {Promise<number[]|import("ethers").BigNumber[]>}
 */
export async function filterTrials(eventParser, filter, limit = undefined) {
  const owner = await eventParser?.contract?.signer?.getAddress();
  if (!owner) return [];

  const logs = await findGames(eventParser.contract);
  if (!logs || logs.length === 0) return [];
  let gids = [];

  for (const log of logs) {
    const ev = eventParser.parse(log);
    if (ev.subject !== owner) continue;

    if (filter) {
      if (awaitable(filter))
        if (!(await filter(ev, eventParser))) continue;
        else if (!filter(ev, eventParser)) continue;
    }

    gids.push(ev.gid);
  }

  if (!isUndefined(limit)) gids = gids.slice(-limit);

  gids.sort((a, b) => {
    return Number(a) - Number(b);
  });

  return gids;
}

/**
 * find gids on the contract, optionally return a specific `which` gid. set which = -1 to get the most recent.
 * @param {*} eventParser
 * @param {undefined|number} which
 */
export async function findGids(eventParser, which = undefined) {
  const logs = await findGames(eventParser.contract);
  if (logs.length === 0) throw new Error(`no games found on contract`);
  if (typeof which === "undefined")
    return logs.map((log) => eventParser.parse(log).gid);
  if (which === -1) which = logs.length - 1;
  return eventParser.parse(logs[which]).gid;
}

export async function findRootLabels(arena, gid) {
  const filter = transcriptEventFilter(
    arena,
    ABIName.TranscriptMerkleRootSet,
    gid
  );
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
