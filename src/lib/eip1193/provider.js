import { ethers } from "ethers";

import { isUndefined, isAsync } from "../idioms.js";

const log = getLogger("eip1193/provider");

export class EIP1193ProviderContext {
  constructor({ accountsChanged, chainChanged, disconnected }) {
    this.reset();

    this._accountsChanged = async (accounts) => {
      this.accounts = accounts;

      if (!accountsChanged) return;

      if (isAsync(accountsChanged)) {
        return await accountsChanged(this);
      }
      return accountsChanged(this);
    };

    this._chainChanged = async (chainId) => {
      this.chainId = alwaysNumber(chainId);

      if (!chainChanged) return;

      if (isAsync(chainChanged)) {
        return await chainChanged(this);
      }
      return chainChanged(this);
    };

    this._disconnected = async (err) => {
      if (err) log.info("provider disconnected", err);
      this.eip1193Provider = undefined;
      this.reset();

      if (!disconnected) return;

      if (isAsync(disconnected)) {
        await disconnected(ctx, err);
      } else {
        disconnected(ctx, err);
      }
    };
  }

  async setProvider(eip1193Provider = undefined, addressOrIndex = 0) {
    this.reset();

    const { provider, chainId, evmProviderType, signer, signerAddress } =
      await setProvider(provider, addressOrIndex, {
        accountsChanged: this._accountsChanged,
        chainChanged: this._chainChanged,
        disconnected: this._disconnected,
      });

    this.provider = provider;
    this.eip1193Provider = eip1193Provider;
    this.chainId = chainId;
    this.evmProviderType = evmProviderType;
    this.signer = signer;
    this.signerAddress = signerAddress;
  }

  reset() {
    if (this.eip1193Provider)
      removeListeners(this.eip1193Provider, {
        accountsChanged: this._accountsChanged,
        chainChanged: this._chainChanged,
        disconnected: this._disconnected,
      });

    this.provider = undefined;
    this.eip1193Provider = undefined;
    this.chainId = undefined;
    this.evmProviderType = undefined;
    this.signer = undefined;
    this.signerAddress = undefined;
    this.accounts = undefined;
  }
}

export async function setProvider(
  provider,
  addressOrIndex = 0,
  { accountsChanged, chainChanged, disconnected }
) {
  if (!provider) {
    if (!getWindowEthereum())
      throw new Error(
        "Please authorize browser extension (Metamask or similar) or provide an RPC based provider"
      );
    getWindowEthereum().autoRefreshOnNetworkChange = false;
    return set1193Provider(getWindowEthereum(), {
      accountsChanged,
      chainChanged,
      disconnected,
    });
  }
  if (typeof provider === "object" && provider.request)
    return set1193Provider(provider, addressOrIndex, {
      accountsChanged,
      chainChanged,
      disconnected,
    });

  if (
    typeof provider !== "object" ||
    (!(
      Object.getPrototypeOf(provider) instanceof ethers.providers.BaseProvider
    ) &&
      !(
        Object.getPrototypeOf(provider) instanceof
        ethers.providers.UrlJsonRpcProvider
      ))
  ) {
    provider = new ethers.providers.JsonRpcProvider(provider);
  }
  const { chainId } = await provider.getNetwork();
  let signer, signerAddress;
  if (addressOrIndex !== null) {
    try {
      // XXX some providers do not support getSigner
      if (typeof provider.listAccounts === "function") {
        signer = provider.getSigner(addressOrIndex);
      } else {
        signer = provider.getSigner();
      }
      signerAddress = await signer.getAddress();
    } catch (err) {
      log.warn(err);
    }
  }
  return {
    provider,
    chainId: alwaysNumber(chainId),
    evmProviderType: provider.constructor.name,
    signer,
    signerAddress,
  };
}

/**
 * accountsChanged may be used as the accountsChanged callback for EIP1193ProviderContext
 * @param {*} ctx
 * @returns
 */
export async function accountsChanged(ctx) {
  return checkProvider({
    provider: ctx.eip1193Provider,
    addressOrIndex:
      Array.isArray(ctx.accounts) && ctx.accounts.length ? ctx.accounts[0] : 0,
    chainId,
  });
}

/**
 * chainChanged may be used as the corresponding callback for EIP1193ProviderContext
 * @param {*} ctx
 * @returns
 */
export async function chainChanged(ctx) {
  return checkProvider({
    provider: ctx.eip1193Provider,
    addressOrIndex: undefined,
    chainId: this.chainId,
  });
}

/**
 * disconnected may be used as the corresponding callback for EIP1193ProviderContext
 * @param {*} ctx
 * @returns
 */
export function disconnected(ctx, err) {
  log.info(
    `provider ${ctx.eipProvider?.constructor?.name} disconnected: ${err}`
  );
}

export function removeListeners(
  eip1193Provider,
  { accountsChanged, chainChanged, disconnected }
) {
  if (!eip1193Provider?.removeListener) return;
  if (accountsChanged)
    eip1193Provider.removeListener("accountsChanged", accountsChanged);
  if (chainChanged)
    eip1193Provider.removeListener("chainChanged", chainChanged);
  if (disconnected) eip1193Provider.removeListener("disconnect", disconnected);
}

export async function set1193Provider(
  eip1193Provider,
  addressOrIndex,
  chainId,
  { accountsChanged, chainChanged, disconnected }
) {
  // Ensure we always remove, though I believe this un-necessary
  removeListeners(eip1193Provider, {
    accountsChanged,
    chainChanged,
    disconnected,
  });
  let accounts;
  try {
    accounts = await eip1193Provider.request({ method: "eth_requestAccounts" });
  } catch (err) {
    log.error(err);
  }

  if (addressOrIndex == null && Array.isArray(accounts) && accounts.length) {
    addressOrIndex = accounts[0];
  }
  const provider = new ethers.providers.Web3Provider(eip1193Provider);
  if (eip1193Provider.on) {
    // TODO handle disconnect/connect events
    if (accountsChanged) eip1193Provider.on("accountsChanged", accountsChanged);
    if (chainChanged) eip1193Provider.on("chainChanged", chainChanged);

    if (!disconnected) disconnected = defaultHandlers.disconnected;
    if (disconnected) eip1193Provider.on("disconnect", disconnected);
  }
  return checkProvider({
    evmProviderType: provider?.constructor?.name,
    provider,
    addressOrIndex,
    chainId,
  });
}

/**
 * checkProvider performs the chainId check on the supplied provider and
 * resolves the addressOrIndex to a signer
 * @param {*} provider
 * @param {*} chainId
 * @param {*} addressOrIndex
 * @returns {object} provider, chainId, signer?, signerAddress
 */
export async function checkProvider({ provider, chainId, addressOrIndex }) {
  if (!chainId) {
    chainId = alwaysNumber((await provider.getNetwork()).chainId);
  }

  let signer;
  let signerAddress;
  if (typeof addressOrIndex !== "undefined") {
    signer = provider.getSigner(addressOrIndex);
    try {
      signerAddress = await signer.getAddress();
    } catch (err) {
      log.info(`signer may not support getSigner`, err);
    }
  }
  return {
    provider,
    chainId,
    signer,
    signerAddress,
  };
}

const alwaysNumber = (n) => (ethers.utils.isHexString(n) ? parseInt(n, 16) : n);

const getGlobalObject = () => {
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  if (typeof self !== "undefined") {
    return self;
  }
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof global !== "undefined") {
    return global;
  }
  throw new Error("[svelte-ethers-store] cannot find the global object");
};

export function getWindowEthereum() {
  try {
    if (getGlobalObject().ethereum) return getGlobalObject().ethereum;
  } catch (err) {
    log.error("no globalThis.ethereum object");
  }
}
