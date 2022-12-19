import { ethers } from "ethers";
import { EIP1193ProviderContext } from "./eip1193/provider.js";
import { getLogger } from "./log.js";
import { isUndefined, isAsync, etherrmsg } from "./idioms.js";
import { ProviderType } from "./providertypes.js";
const log = getLogger("providerdiscovery");

export class ProviderContext extends EIP1193ProviderContext {
  constructor(cfg = {}) {
    super(cfg);
    this.cfg = cfg;
  }

  async setProvider(eip1193Provider, addressOrIndex = 0) {
    return super.setProvider(eip1193Provider, addressOrIndex, this.cfg.chainId);
  }

  async prepareProvider() {
    // Check it using the static provider
    let provider;
    if (!this.cfg.static) {
      log.info(`<<<Preparing polling provider>>>> ${this.cfg.url}`);
      provider = new ethers.providers.JsonRpcProvider({
        url: this.cfg.url,
        ...this.cfg.info,
      });
    } else {
      log.info(`<<<Preparing static provider>>>>  ${this.cfg.url}`);
      provider = new ethers.providers.StaticJsonRpcProvider({
        url: this.cfg.url,
        ...this.cfg.info,
      });
    }
    await this.setProvider(provider);
    this.stopListening();
    return this;
  }
}

export class ProviderSwitch {
  constructor(opts = {}) {
    this.available = {};
    this.current = undefined;

    const { chainChanged, accountsChanged, disconnected, prepared, stopped } =
      opts;
    this.chainChanged = async (name, ctx) => {
      log.debug(
        `provider ${name} chainChanged. chain=${ctx.chainId}, url=${ctx.url}`
      );
      if (!chainChanged) return;
      try {
        return chainChanged(name, ctx);
      } catch (err) {
        log.info(`error issuing chainChanged callback for ${name}: ${err}`);
      }
    };
    this.accountsChanged = async (name, ctx) => {
      log.debug(
        `provider ${name} accountsChanged. len(accounts)=${ctx.accounts.length}`
      );
      if (!accountsChanged) return;
      try {
        return accountsChanged(name, ctx);
      } catch (err) {
        log.info(`error issuing accountsChanged callback for ${name}: ${err}`);
      }
    };
    this.disconnected = async (name, ctx) => {
      log.debug(`provider ${name} disconnected. err=${etherrmsg(err)}`);
      if (!disconnected) return;
      try {
        return disconnected(name, ctx);
      } catch (err) {
        log.info(`error issuing disconnected callback for ${name}: ${err}`);
      }
    };

    this.prepared = async (name, ctx) => {
      log.debug(
        `provider ${name} prepared. chain=${ctx.chainId}, url=${ctx.url}`
      );
      if (!prepared) return;
      try {
        return prepared(name, ctx);
      } catch (err) {
        log.info(`error issuing prepared callback for ${name}: ${err}`);
      }
    };

    this.stopped = async (name, ctx) => {
      log.debug(`provider ${name} stopped. url=${ctx.url}`);
      if (!stopped) return;
      try {
        return stopped(name, ctx);
      } catch (err) {
        log.info(`error issuing stopped callback for ${name}: ${err}`);
      }
    };
  }

  async select(name) {
    const ctx = this.available[name];
    if (!ctx) {
      throw new Error(`provider ${name} is not currently available`);
    }
    await ctx.resume();
    this.current = name;
    return ctx;
  }

  async stopAll() {
    for (const [name, ctx] of Object.entries(this.available)) {
      ctx.reset();
      await this.stopped(name, ctx);
    }
    this.available = {};
    this.current = undefined;
  }

  async prepare(cfgs, contextfactory) {
    this.available = await this.beginPrepare(cfgs, contextfactory);
    // issue the prepared callbacks after _all_ have had a chance to finish. may
    // revisit this, depending on how responsive it is. it may  be better ux to
    // just kick these immediately, but it makes the connection & start up logs
    // confusing.
    for (const [name, each] of Object.entries(this.available)) {
      try {
        await this.prepared(name, each);
      } catch (err) {
        log.info(`error issuing prepared callback for ${name}: ${err}`);
      }
    }
  }

  async beginPrepare(cfgs, contextfactory) {
    await this.stopAll();

    if (isUndefined(contextfactory)) {
      contextfactory = (cfg) => new ProviderContext(cfg);
    }
    const prepared = {};
    const preparing = [];

    // Take the injected providers as is. Accumulate an array of promises for the
    // rest
    for (const each of Object.values(cfgs)) {
      const ctx = contextfactory({
        ...each,
        chainChanged: async (chainId) => this.chainChanged(each.name, ctx),
        accountsChanged: async (accounts) =>
          this.accountsChanged(each.name, ctx),
        disconnected: async (err) => this.disconnected(each.name, ctx, err),
      });
      if (each.type === ProviderType.Injected) {
        // The injected ones don't get pre-checked, as that forces interaction
        prepared[each.name] = ctx;
        continue;
      }
      preparing.push(ctx.prepareProvider());
    }

    // If we don't have any non injected providers we are done
    if (preparing.length === 0) {
      return prepared;
    }

    // Resolve the promises for rpc providers
    return Promise.all(
      preparing.map((p) =>
        p.catch((e) => log.info(`unexpected error checking provider: ${e}`))
      )
    )
      .then((values) => {
        for (const ctx of values) {
          if (isUndefined(ctx)) continue;
          log.debug(`adding provider ${ctx.cfg.name} ${ctx.cfg.url}`);
          prepared[ctx.cfg.name] = ctx;
          ctx.stopListening();
        }
        return prepared;
      })
      .catch((e) => {
        log.info(`unexpected error checking providers: ${e}`);
        return prepared;
      });
  }
}

export async function prepareProviders(cfgs) {
  const prepared = {};
  const preparing = [];

  // Take the injected providers as is. Accumulate an array of promises for the
  // rest
  for (const each of Object.values(cfgs)) {
    const ctx = new ProviderContext(each);
    if (each.type === ProviderType.Injected) {
      // The injected ones don't get pre-checked, as that forces interaction
      prepared[each.name] = ctx;
      continue;
    }
    preparing.push(ctx.prepareProvider());
  }

  // If we don't have any non injected providers we are done
  if (preparing.length === 0) {
    return prepared;
  }

  // Resolve the promises for rpc providers
  return Promise.all(
    preparing.map((p) =>
      p.catch((e) => log.info(`unexpected error checking provider: ${e}`))
    )
  )
    .then((values) => {
      for (const ctx of values) {
        if (isUndefined(ctx)) continue;
        log.debug(`adding provider ${ctx.cfg.name} ${ctx.cfg.url}`);
        prepared[ctx.cfg.name] = ctx;
      }
      return prepared;
    })
    .catch((e) => {
      log.info(`unexpected error checking providers: ${e}`);
      return prepared;
    });
}
