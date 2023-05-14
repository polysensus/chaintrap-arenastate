import { ethers } from "ethers";
import { isV1GameEvent, isV2GameEvent } from "./abiconst.js";

/**
 * GameEvent is a normalized wrapper for all chaintrap contract events which
 * affect game state. Supports v1 "tracing paper" game events, and v2 merkle
 * argument events.
 */
export class GameEvent {
  /**
   * @constructor
   * @template {{gid, event, subject?, ethEvent, blockNumber, transactionHash}} ParsedGameLogLike
   * @param {ParsedGameLogLike} gameLog parsed and normalized game event
   */
  constructor(gameLog) {
    Object.assign(this, gameLog);
  }

  /**
   * @template {{args, blockNumber, data, topics, transactionHash, transactionIndex}} ParsedLogLike
   * @param {ParsedLogLike} ev ethers event, parsed according to the contract ABI.
   */
  static fromParsedEvent(ev) {
    if (isV1GameEvent(ev)) return GameEvent.fromV1(ev);
  }

  /**
   * Convert a v1 parsed ethers event to its general GameEvent representation.
   * This form is very explicit.
   * @param {*} ev
   */
  static fromV1(ev) {
    let gid = ev.args.gid;
    if (ethers.BigNumber.isBigNumber(gid)) gid = ethers.BigNumber.from(gid);

    const o = {
      gid,
      event: ev.event,
      subject: ev.args.player,
      ethEvent: ev,
      blockNumber: ev.blockNumber,
      transactionHash: ev.transactionHash,
    };
  }
  static fromV2(ev) {}
}
