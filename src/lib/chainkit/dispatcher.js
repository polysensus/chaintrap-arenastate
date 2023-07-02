import { logFromEthersCallbackArgs } from "./eventparser.js";
import { getLogger } from "../log.js";

const log = getLogger("dispatcher");

export class Dispatcher {
  constructor(eventParser, opts) {
    this.parser = eventParser;
    //  assume the parser is never re-bound to another contract instance.
    //  otherwise its not possible to clean up the listeners reliably
    this.contract = this.parser.contract;

    this.listeners = {};
    this.active = {};
  }

  createHandler(callback, signature, ...args) {
    const filter = this.contract.getFilter(signature, ...args);
    return {
      filter,
      signature,
      callback,
    };
  }

  /**
   * @param {{callback,filter,signature,listener}} handler a handler created by calling {@link createHandler}
   * @param {any} key arbitrary id which defaults to the handler callback
   * object, it is provided as context to the callback if it is != callback
   * @returns
   */
  addHandler(handler, key = undefined) {
    const id = key ?? handler.callback;

    handler.listener = this.wrapCallback(handler.callback, key);

    this.listeners[id] = handler;
    return id;
  }

  removeHandler(id) {
    this.stopListening(id);
    delete this.listeners[id];
  }

  /**
   * remove the identified ethers listening callback, or remove them all if no id is provided.
   *
   * @param {any} id of a specific handler, by default all current active listeners are stopped
   */
  stopListening(id = undefined) {
    const entries = id ? [id] : Object.keys(this.active);

    for (const id of entries) {
      if (!this.active[id]) continue;
      const { filter, listener } = this.active[id];
      this.contract.off(filter, listener);

      delete this.active[id];
    }
  }

  /**
   * start listening for the identified ethers listener, or start them all if no
   * specific listener is identified.
   * @param {any} id of a specific handler, by default all current non active listeners are started.
   */
  startListening(id = undefined) {
    const entries = id ? [id] : Object.keys(this.listeners);

    for (const id of entries) {
      if (id in this.active) continue;

      const handler = this.listeners[id];
      this.contract.on(handler.filter, handler.listener);
      this.active[id] = handler;
    }
  }

  wrapCallback(callback, key) {
    const wrapped = async (...listenerArgs) => {
      const log = logFromEthersCallbackArgs(listenerArgs);
      if (!log) return;

      const ev = this.parser.parse(log);
      if (!ev) return;

      const args = [];
      if (key !== callback) args.push(key);

      return callback(ev, ...args);
    };
    return wrapped;
  }
}
