import { ethers } from "ethers";
const arrayify = ethers.utils.arrayify;
import * as msgpack from "@msgpack/msgpack";

import {
  isV1GameEvent as isV1ArenaEvent,
  isV2GameEvent as isV2ArenaEvent,
  ABIName2,
} from "../abiconst.js";

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
   * @param {ParsedLogLike} ev ethers event, parsed according to the contract ABI.
   */
  static fromParsedEvent(ev) {
    const parsed = {
      // Note: until we clear out the old events we need the ??
      gid: ev.args.id ?? ev.args.gid,
      name: ev.name,
      log: ev,
      data: undefined,
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
        parsed.data = msgpack.decode(arrayify(ev.args.profile));
        break;
      case ABIName2.RevealedChoices:
        parsed.subject = ev.args.participant;
        parsed.eid = ev.args.eid;
        // parsed.choices = ev.args.choices;
        parsed.data = msgpack.decode(arrayify(ev.args.data));
        parsed.scene = parsed.data;
        break;

      case ABIName2.ActionCommitted:
        parsed.eid = ev.args.eid;
        parsed.subject = ev.args.participant;
        parsed.rootLabel = ev.args.rootLabel;
        parsed.data = ev.args.data;
        break;
      case ABIName2.ArgumentProven:
        parsed.eid = ev.args.eid;
        parsed.subject = ev.args.participant;
        parsed.advocate = ev.args.advocate;
        parsed.data = ev.args.data;
        break;
      case ABIName2.OutcomeResolved:
        parsed.eid = ev.args.eid;
        parsed.subject = ev.args.participant;
        parsed.rootLabel = ev.args.rootLabel;
        parsed.outcome = ev.args.outcome;
        parsed.data = ev.args.data;
        break;
      /*
      default:
        throw new Error(`event ${ev.name} with signature ${ev.signature} not recognized for ABIv2`);
        */
    }
    return new ArenaEvent(parsed);
  }
}
