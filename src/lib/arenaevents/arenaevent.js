import { ethers } from "ethers";
import { isV1GameEvent as isV1ArenaEvent, isV2GameEvent as isV2ArenaEvent, ABIName2 } from "../abiconst.js";

/**
 * ArenaEvent is a normalized wrapper for all chaintrap contract events which
 * affect game state. Supports v1 "tracing paper" game events, and v2 merkle
 * argument events.
 */
export class ArenaEvent {
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
    if (isV1ArenaEvent(ev) && isV2ArenaEvent(ev)) return ArenaEvent.fromV2(ev);
    if (isV2ArenaEvent(ev)) return ArenaEvent.fromV2(ev);
    if (isV1ArenaEvent(ev)) return ArenaEvent.fromV1(ev);
  }

  /**
   * Convert a v1 parsed ethers event to its general ArenaEvent representation.
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
    return new ArenaEvent(parsed);
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
    return new ArenaEvent(parsed);
  }
}
