/**
 * Provides a way to filter transactions that have recently been encountered.
 * Ethers js can't guarantee not to give duplicates.
 */
import { isUndefined } from "./idioms.js";
import { getLogger } from "./log.js";
const log = getLogger("TxMemo");
const fmt = (msg) => `TxMemo:${msg}`;

export class TxMemo {
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

  haveEventTx(e) {
    return typeof this._recentTx[e.transactionHash] !== "undefined";
  }

  eventTxMemo(e) {
    if (this.haveEventTx(e)) {
      log.debug(fmt(`<<<<<< Have memo for ${e.transactionHash}`));
      return true;
    }

    log.debug(fmt(`>>>>>> memo for ${e.transactionHash}`));
    this._recentTx[e.transactionHash] = e;
    // if (!this._haveSeenEvent(e)) throw Error('erk ???')

    if (isUndefined(this._recentBlockTx[e.blockNumber])) {
      this._recentBlockTx[e.blockNumber] = [];
    }
    this._recentBlockTx[e.blockNumber].push(e.transactionHash);

    if (e.blockNumber < this._lowestBlock) {
      this._lowestBlock = e.blockNumber;
    }
    if (e.blockNumber > this._highestBlock) {
      this._highestBlock = e.blockNumber;
    }

    // We may not see events in all blocks. We probably wont. This arrangement
    // means if we only have two blocks but they are > horizon appart, we will
    // drop the lowest and stop. ie this is a true horizon not a count of blocks
    // to retain. A priority queue would be nice here
    if (this._highestBlock - this._lowestBlock > this._blockHorizon) {
      const known = Object.keys(this._recentBlockTx).map(Number);
      known.sort();
      known.reverse();

      while (
        known.length > 1 &&
        this._highestBlock - this._lowestBlock > this._blockHorizon
      ) {
        const bn = known.pop(); // pops the lowest because we reversed above
        for (const tx of this._recentBlockTx[bn]) {
          delete this._recentTx[tx];
          log.debug(`droping memo of ${tx}`);
        }
        delete this._recentBlockTx[bn];
        this._lowestBlock = known[known.length - 1];
      }
    }
    return false;
  }
}
