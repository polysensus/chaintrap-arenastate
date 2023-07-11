import { ethers } from "ethers";

import { NFTStorage, File } from "nft.storage";

import { getLogger } from "../log.js";

const log = getLogger("nftstorage");

export const nftStorageURL = "https://api.nft.storage";

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
