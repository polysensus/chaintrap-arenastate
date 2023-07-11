import { fileObjectFromBinary } from "./nftstorage.js";

/**
 *
 * @param {BlobCodex} blobcodex
 * @param {{client?,nftstorageAPIKey?,nftstorageURL?}} options either a client instance or the options to create one.
 */
export function blobcodexMetadataProperty(blobcodex, options = {}) {
  const filename =
    options.filename ?? options.codexFilename ?? "blobcodex.json";

  const namedItems = [];
  for (const name of Object.keys(blobcodex.index)) namedItems.push(name);

  const s = blobcodex.serialize();
  const bin = JSON.stringify(s); // serialize guarantees to drop any plaintext .value attributes on item blobs
  const f = fileObjectFromBinary(bin, filename, "application/json");
  return {
    namedItems,
    ikeys: s.ikeys,
    ipfs: f,
  };
}
