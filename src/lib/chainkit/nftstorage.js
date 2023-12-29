import { NFTStorage, File } from "nft.storage";

import { getLogger } from "../log.js";

const log = getLogger("nftstorage");

export const IPFSScheme = "ipfs://";
export const nftStorageURL = "https://api.nft.storage";
// export const nftstorageIPFSGatewayURL = "https://ipfs.io/";
export const nftstorageIPFSGatewayURL = "https://nftstorage.link/";

export function ipfsGatewayURL(ipfs, options = {}) {
  if (!ipfs.startsWith(IPFSScheme))
    throw new Error(`ipfs url must have the ${IPFSScheme} scheme`);

  let gatewayURL =
    options.nftstorageGatewayUrl ??
    options.ipfsGatewayUrl ??
    nftstorageIPFSGatewayURL;
  if (!gatewayURL.endsWith("/")) gatewayURL = gatewayURL + "/";

  gatewayURL = `${gatewayURL}ipfs/${ipfs.slice(IPFSScheme.length)}`;
  return gatewayURL;
}

/**
 * Create an nftstorage.File object wrapping a binary blob
 * @param {*} bin
 * @param {string} name
 * @param {string} type
 * @returns
 */
export function fileObjectFromBinary(bin, name, type = "image/png") {
  return new File([bin], name, { type });
}

/**
 * Create a client from the provided generic, prefix discriminated, options bag
 * @param {{nftstorageAPIKey,nftstorageURL?}} options
 * @returns
 */
export function createClient(options) {
  return new NFTStorage(clientOptions(options));
}

/**
 * Get the client options from a generic prefixed options bag.
 * @param {{nftstorageAPIKey,nftstorageURL?}} options
 */
export function clientOptions(options) {
  if (!options.nftstorageAPIKey)
    throw new Error(`an api key for nft.storage is required`);

  return {
    token: options.nftstorageAPIKey,
    endpoint: options.nftstorageURL ?? nftStorageURL,
  };
}
