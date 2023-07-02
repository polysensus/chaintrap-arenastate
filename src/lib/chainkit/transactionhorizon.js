import { isUndefined } from "../idioms.js";
import { getLogger } from "../log.js";
const log = getLogger("TransactionHorizon");
const fmt = (msg) => `TransactionHorizon:${msg}`;

/**
 * Provides a way to filter transactions that have recently been encountered.
 * Ethers js can't guarantee not to give duplicates.
 */
export class TransactionHorizon {
  constructor(horizon = 100) {
    this._blockHorizon = horizon;
    this.reset();
  }

  reset() {
    // map of tx -> event
    this._recentTx = {};
    // block -> array of tx
    this._recentBlockTx = {};
    this._lowestBlock = Number.MAX_SAFE_INTEGER;
    this._highestBlock = 0;
  }

  logId(log) {
    return `${log.transactionHash}${log.transactionIndex}:${log.logIndex}`
  }

  /**
   * @template {{transactionHash}} EventLike
   * @param {EventLike} e
   * @returns
   */
  haveEvent(e) { return this.haveLogId(this.logId(e.log)); }

  haveLogId(id) { return typeof this._recentTx[id] !== "undefined"; }

  /**
   * @template {{blockNumber, transactionHash}} EventLike
   * @param {EventLike} e
   * @returns
   */
  known(e) {
    const logId = this.logId(e.log);
    if (this.haveLogId(logId)) {
      return true;
    }

    this._recentTx[logId] = e;

    if (isUndefined(this._recentBlockTx[e.blockNumber])) {
      this._recentBlockTx[e.blockNumber] = [];
    }
    this._recentBlockTx[e.blockNumber].push(logId);

    if (e.blockNumber < this._lowestBlock) {
      this._lowestBlock = e.blockNumber;
    }
    if (e.blockNumber > this._highestBlock) {
      this._highestBlock = e.blockNumber;
    }

    if (this._blockHorizon === false) {
      // Configured to remember ALL transactions
      return;
    }

    // We may not see events in all blocks. We probably wont. This arrangement
    // means if we only have two blocks but they are > horizon apart, we will
    // drop the lowest and stop. ie this is a true horizon not a count of blocks
    // to retain.
    if (this._highestBlock - this._lowestBlock > this._blockHorizon) {
      const known = Object.keys(this._recentBlockTx).map(Number);
      known.sort();
      known.reverse();

      while (
        known.length > 1 &&
        this._highestBlock - this._lowestBlock > this._blockHorizon
      ) {
        const bn = known.pop(); // pops the lowest because we reversed above
        for (const logId of this._recentBlockTx[bn]) {
          delete this._recentTx[logId];
          log.debug(`droping memo of ${logId}`);
        }
        delete this._recentBlockTx[bn];
        this._lowestBlock = known[known.length - 1];
      }
    }
    return false;
  }
}
