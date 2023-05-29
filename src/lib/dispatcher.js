import { TxMemo } from "./txmemo.js";
import { parseEthersEvent } from "./arenaevents/eventparser.js";
import { getLogger } from "./log.js";

const log = getLogger("dispatcher");

const defaultMemoBlockHorizon = 30;

export class Dispatcher {
  constructor(contract, opts) {
    this.contract = contract;

    this.txmemo = opts?.txmemo ?? new TxMemo(defaultMemoBlockHorizon);
    this.listeners = [];
    this.active = [];
  }

  addHandler(handler, signature, ...args) {
    const filter = this.getFilter(signature, ...args);
    return this.addFilterHandler(filter, handler, ...args);
  }

  addFilterHandler(filter, handler) {
    const listener = this.wrapHandler(handler);
    this.listeners.push([filter, listener, filter, handler]);
  }

  stopListening() {
    while (this.active.length > 0) {
      const [event, listener, signature] = this.active.pop();
      this.contract.off(event, listener);
      log.debug(
        `Stopped listening for ${signature}, with ${JSON.stringify(event)}`
      );
    }
  }

  startListening() {
    this.stopListening();

    for (const [event, listener, signature] of this.listeners) {
      this.contract.on(event, listener);
      this.active.push([event, listener, signature]);
      log.debug(`Listening for ${signature}, with ${JSON.stringify(event)}`);
    }
  }

  wrapHandler(handler) {
    const wrapped = async (...args) => {
      if (args.length === 0) {
        log.info("bad callback from ethers, args empty");
        return;
      }

      let ev = args[args.length - 1];
      let iface;
      // ask the proxy for the appropriate decoding interface
      try {
        iface = this.contract.getEventInterface(ev); // throws
      } catch (err) {
        log.info(`event ${ev?.topics?.[0]} not found: ${err}`);
        return;
      }
      ev = parseEthersEvent(iface, this.txmemo, ev);
      if (!ev) return;
      log.debug({ name: ev.name, args: JSON.stringify(ev.args) });
      return handler(ev);
    };
    return wrapped;
  }

  removeAll() {
    this.stopListening();
    this.listeners = [];
    this.active = [];
  }

  removeHandler(handler) {
    for (let i = 0; i < this.listeners.length; i++) {
      const [f, l, s, h] = this.listeners[i];
      if (h !== handler) continue;
      this.listeners.splice(i, 1);
      log.debug(`removed handler for ${s}`);

      for (let j = 0; j < this.active.length; j++) {
        const [f, al, s] = this.active[j];
        if (l !== al) continue;
        this.contract.off(f, al);
        this.active.splice(j, 1);
        log.debug(`stoped handler for ${s}`);
        break;
      }
      break;
    }
  }

  getFilter(signature, ...args) {
    return this.contract.getFilter(signature, ...args);
  }
}
