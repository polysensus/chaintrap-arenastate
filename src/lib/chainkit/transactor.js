/**
 *
 * @typedef {import("../arenaevent.js").ArenaEvent} ArenaEvent
 */
import { customError } from "../arenaabi.js";

/**
 * @typedef {import("ethers").utils.TransactionReceipt} TransactionReceipt
 */
export class TransactResult {
  /**
   * @constructor
   * @param {import("ethers").utils.TransactionReceipt} receipt
   * @param {{string:ArenaEvent}} events
   */
  constructor(receipt, events, ordered) {
    this.r = receipt;
    this._events = events;
    this.ordered = ordered;
  }

  eventByName(name, which = 0) {
    if (!this._events[name]) throw new Error(`event ${name} not collected`);
    if (which === -1) which = this._events[name].length - 1;

    if (which >= this._events[name].length)
      throw new Error(
        `event ${name} only ${this._events[name].length} were collected`
      );

    return this._events[name][which];
  }

  *events() {
    for (const [name, which] of this.ordered)
      yield this.eventByName(name, which);
    // yield this.events[name][which];
  }
  // todo: eventSigs over const [name, nameWhich, sig, sigWhich]
}

/**
 * TransactRequests is a convenience for invoking a *sequence* of transactions using {@link TransactRequest} instances
 * Each call to {@link Transactor.method} adds appends a new transaction.
 */
export class Transactor {
  /**
   * @constructor
   * @param {LogParser} logParser - an instance that implements a receiptLogs parser
   */
  constructor(logParser) {
    /**@readonly */
    this.logParser = logParser;

    /**@readonly */
    this.sequence = [];
  }

  _head() {
    return this.sequence[this.sequence.length - 1];
  }

  /**
   * @param {*} method - awaitable method which returns a transaction
   * @param  {...any} args - arguments for the method
   */
  method(method, ...args) {
    const request = new TransactRequest(this.logParser);
    this.sequence.push(request.method(method, ...args));
    return this;
  }

  /**
   * A variable number of log signatures to anticipate.
   * @param  {string} signatures
   */
  acceptLogs(...signatures) {
    this._head().acceptLogs(...signatures);
    return this;
  }

  /**
   * A variable number of log signatures to require.
   * @param  {string} signatures
   */
  requireLogs(...signatures) {
    this._head().requireLogs(...signatures);
    return this; // chainable
  }

  /**
   * A variable number of log names to require.
   * @param  {...any} names
   * @returns
   */
  requireLogNames(...names) {
    this._head().requireLogNames(...names);
    return this; // chainable
  }

  /**
   * A variable number of log signatures to exclude. If any are present, the
   * result will have a suitable err on it.
   * @param  {string} signatures
   */
  excludeLogs(...signatures) {
    this._head().excludeLogs(...signatures);
    return this; // chainable
  }

  /**
   * Invoke the arenaMethod with its arguments and process the result
   * @returns {TransactResult[]}
   */
  async *transact() {
    for (const request of this.sequence) {
      yield request.transact();
    }
  }
}

/**
 * TransactRequest is a convenience for invoking arena transactions and
 * processing the result.
 *
 * @template {{receiptLogs():Event[]}} LogParser
 */
export class TransactRequest {
  /**
   * @constructor
   * @param {LogParser} logParser - an instance that implements a receiptLogs parser
   */
  constructor(logParser) {
    /**@readonly */
    this.logParser = logParser;
    /**@readonly */
    this._method = undefined;
    /**@readonly */
    this.args = undefined;
    /**
     * @type {undefined|{anticipated:string[], required:string[], excluded:string[]}}
     */
    this.logs = {
      anticipated: [],
      required: [],
      requiredNames: [],
      excluded: [],
    };
  }

  /**
   * @param {*} method - awaitable method which returns a transaction
   * @param  {...any} args - arguments for the method
   */
  method(method, ...args) {
    this._method = method;
    this.args = args;
    return this; // chainable
  }

  /**
   * A variable number of log signatures to anticipate.
   * @param  {string} signatures
   */
  acceptLogs(...signatures) {
    this.logs.anticipated.push(...signatures);
    return this; // chainable
  }

  /**
   * A variable number of log signatures to require. If any are missing, the
   * result will have a suitable err on it.
   * @param  {string} signatures
   */
  requireLogs(...signatures) {
    this.logs.required.push(...signatures);
    return this; // chainable
  }

  /**
   * @param  {...any} names a variable number of event *names* to require
   * @returns
   */
  requireLogNames(...names) {
    this.logs.requiredNames.push(...names);
    return this; // chainable
  }

  /**
   * A variable number of log signatures to exclude. If any are present, the
   * result will have a suitable err on it.
   * @param  {string} signatures
   */
  excludeLogs(...signatures) {
    this.logs.excluded.push(...signatures);
    return this; // chainable
  }

  expectations() {
    const requiredNames = Object.fromEntries(
      this.logs.requiredNames.map((k) => [k, true])
    );
    const required = Object.fromEntries(
      this.logs.required.map((k) => [k, true])
    );
    const anticipated = Object.fromEntries(
      this.logs.anticipated.map((v) => [v, true])
    );
    for (const k of this.logs.required) anticipated[k] = true;
    const excluded = Object.fromEntries(
      this.logs.excluded.map((k) => [k, true])
    );
    return {
      requiredNames,
      required,
      anticipated,
      excluded,
    };
  }

  collect(r) {
    const { requiredNames, required, anticipated, excluded } =
      this.expectations();

    const collected = {};
    const ordered = [];

    for (const gev of this.logParser.receiptLogs(r)) {
      // collate anticipated, required and throw on excluded
      // gev.format
      const sig = gev.parsedLog.signature;
      const name = gev.parsedLog.name;

      // Note: we check collected so we can collect > 1 requiredName
      if (!(sig in anticipated || name in requiredNames || name in collected))
        throw new Error(`unexpected log signature ${sig}`);
      if (sig in excluded) throw new Error(`excluded log signature ${sig}`);
      delete required[sig];
      if (name in requiredNames) {
        delete requiredNames[name];
      }

      collected[sig] = [...(collected[sig] ?? []), gev];
      collected[name] = [...(collected[name] ?? []), gev];
      ordered.push([
        name,
        collected[name].length - 1,
        sig,
        collected[sig].length - 1,
      ]);
    }

    if (Object.keys(required).length !== 0)
      throw new Error(
        `required signatures missing: ${Object.keys(required).join(", ")}`
      );

    return new TransactResult(r, collected, ordered);
  }

  /**
   * Invoke the arenaMethod with its arguments and process the result
   * @returns {TransactResult}
   */
  async transact() {
    let tx, r;

    try {
      tx = await this._method(...this.args);
      r = await tx.wait();
    } catch (err) {
      // This will match the custom solidity errors on the contracts which are
      // obscured by the diamond proxy and re-throw as human readable
      // representations of the raw error selectors.
      throw customError(err);
    }

    return this.collect(r);
  }
}

/**
 *
 * @param {{required:string[], accepted:string[]}} logs - required and expected logs to collect from the receipt
 * @param {*} arenaMethod - a method on the arena proxy which returns a transaction
 * @param  {...any} args
 */
export async function transact(logs, arenaMethod, ...args) {}
