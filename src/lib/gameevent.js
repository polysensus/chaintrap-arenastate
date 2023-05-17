import { ethers } from "ethers";
import { isV1GameEvent, isV2GameEvent, ABIName2 } from "./abiconst.js";

/**
 * GameEvent is a normalized wrapper for all chaintrap contract events which
 * affect game state. Supports v1 "tracing paper" game events, and v2 merkle
 * argument events.
 */
export class GameEvent {
  /**
   * @constructor
   * @template {{
   *  id:ethers.BigNumber,
   *  subject?,
   *  data?,
   *  log:ethers.utils.LogDescription
   * }} ParsedGameLogLike
   * @param {ParsedGameLogLike} parsed parsed and normalized game event
   */
  constructor(parsed) {
    Object.assign(this, parsed);
  }

  /**
   * @template {{args, blockNumber, data, topics, transactionHash, transactionIndex}} ParsedLogLike
   * @param {ParsedLogLike} ev ethers event, parsed according to the contract ABI.
   */
  static fromParsedEvent(ev) {
    if (isV1GameEvent(ev) && isV2GameEvent(ev)) return GameEvent.fromV2(ev);
    if (isV2GameEvent(ev)) return GameEvent.fromV2(ev);
    if (isV1GameEvent(ev)) return GameEvent.fromV1(ev);
  }

  /**
   *
   * @param {ethers.Contract | import("@polysensus/chaintrap-contracts").ERC2535DiamondFacetProxyHandler} arena - the contract instance or diamond proxy
   * @param {ethers.TransactionReceipt} receipt - the receipt for the transaction that will have the log from which to build the event
   * @param {string} eventNameOrSignature - the name or signature of the event to require in the receipt logs
   */
  static fromReceipt(arena, receipt, eventNameOrSignature) {
    if (receipt.status !== 1) throw new Error("bad receipt status");
    for (const log of receipt.logs) {
      const iface = arena.getEventInterface(log);
      if (!iface) continue;
      const gev = GameEvent.fromParsedEvent(iface.parseLog(log));
      if (!gev) continue;
      if (
        gev?.name === eventNameOrSignature ||
        gev.log.signature === eventNameOrSignature
      )
        return gev;
    }
  }

  /**
   * Convert a v1 parsed ethers event to its general GameEvent representation.
   * This form is very explicit.
   * @param {*} ev
   */
  static fromV1(ev) {
    const parsed = {
      gid: ev.args.gid,
      name: ev.name,
      subject: ev.args.player,
      log: ev,
    };
    return new GameEvent(parsed);
  }
  static fromV2(ev) {
    const parsed = {
      // Note: until we clear out the old events we need the ??
      gid: ev.args.id ?? ev.args.gid,
      name: ev.name,
      log: ev,
    };
    switch (ev.name) {
      case ABIName2.GameCreated:
        parsed.subject = ev.args.creator;
        break;
      case ABIName2.GameStarted:
        break;
      case ABIName2.GameCompleted:
        break;
      case ABIName2.ParticipantRegistered:
        parsed.subject = ev.args.participant;
        break;
      case ABIName2.ActionCommitted:
        parsed.subject = ev.args.participant;
        break;
      case ABIName2.ArgumentProven:
        parsed.subject = ev.args.participant;
        break;
      case ABIName2.OutcomeResolved:
        parsed.subject = ev.args.participant;
        break;
      /*
      default:
        throw new Error(`event ${ev.name} with signature ${ev.signature} not recognized for ABIv2`);
        */
    }
    return new GameEvent(parsed);
  }
}
