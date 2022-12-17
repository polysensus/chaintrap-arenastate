import { ethers } from "ethers";
import { EIP1193ProviderContext } from './eip1193/provider.js';
import { getLogger } from './log.js'
import { isUndefined } from './idioms.js';
import { ProviderType } from './providertypes.js';
const log = getLogger("providerdiscovery");

export class ProviderContext extends EIP1193ProviderContext {
  constructor (cfg ) {
    super();

    this.cfg = cfg
  }

  async setProvider(eip1193Provider, addressOrIndex = 0) {
    return super.setProvider(eip1193Provider, addressOrIndex, this.cfg.chainId)
  }

  async prepareProvider() {
    // --- check for the hardhat test provider first
    if (this.cfg.type === ProviderType.Hardhat) {
      const provider = await import('@nomiclabs/hardhat-ethers').catch(
        (err) => console.log(`could not import hardhat-ethers: ${err}, trying JsonRpcProvider`)
      )

      if (isUndefined(provider)) {
        return;
      }
      await this.setProvider(provider);
      this.stopListening();
      return this;
    }

    // Check it using the static provider
    let provider;
    if (!this.cfg.static ) {
      provider = new ethers.providers.JsonRpcProvider({ url: this.cfg.url, ...this.cfg.info });
    } else {
      provider = new ethers.providers.StaticRpcProvider({ url: this.cfg.url, ...this.cfg.info });
    }
    await this.setProvider(provider);
    this.stopListening();
    return this;
  }
}

export async function prepareProviders(cfgs) {
  const prepared = {}
  const preparing = []

  // Take the injected providers as is. Accumulate an array of promises for the
  // rest
  for (const each of Object.values(cfgs)) {
    const ctx = new ProviderContext(each);
    if (each.type === ProviderType.Injected) {
      // The injected ones don't get pre-checked, as that forces interaction
      prepared[each.name] = ctx
      continue
    }
    preparing.push(ctx.prepareProvider())
  }

  // If we don't have any non injected providers we are done
  if (preparing.length === 0) {
    return prepared;
  }

  // Resolve the promises for rpc providers
  return Promise.all(
    preparing.map(p => p.catch(e => log.info(`unexpected error checking provider: ${e}`))))
    .then(values => {
      for (const ctx of values) {
        if (isUndefined(ctx)) continue
        log.debug(`adding provider ${ctx.cfg.name} ${ctx.cfg.url}`)
        prepared[ctx.cfg.name] = ctx
      }
      return prepared
    })
    .catch(e => {
      log.info(`unexpected error checking providers: ${e}`)
      return prepared;
    })
}