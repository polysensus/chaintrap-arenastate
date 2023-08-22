// read game metadata from a token url

import { ipfsGatewayURL, IPFSScheme } from "../chainkit/nftstorage.js";
import { BlobCodex } from "@polysensus/blobcodex";

import { CODEX_INDEXED_ITEMS, CODEX_FURNITURE_INDEX } from "../guardian.js";
// All of the items expected in a trial setup serialized as an encrypted blob codex.
/**
 *
 * @param {string} ipfsURL
 * @param {{fetch,ipfsGatewayUrl?,ipfsAuthToken?}} options
 */
export async function ipfsFetchJSON(fetch, ipfsURL, options = {}) {
  if (!ipfsURL.startsWith(IPFSScheme))
    throw new Error(`url must have ipfs scheme: ${ipfsURL}`);
  const url = ipfsGatewayURL(ipfsURL, options);
  const headers = {
    "Content-Type": "application/json",
  };
  if (options.ipfsAuthToken)
    headers["Authorization"] = `Bearer ${options.ipfsAuthToken}`;

  const resp = await fetch(url, { method: "get", headers });
  const j = await resp.json();
  return j;
}

export class GameMetadataReader {
  /**
   *
   * @param {{fetch,ipfsGatewayUrl?,ipfsAuthToken?}} options
   */
  constructor(options) {
    if (!(options.fetch || options.readJson))
      throw new Error(
        "a fetch implementation or a json file reader must be provided in the options"
      );

    this.fetch = options.fetch;
    this.readJson = options.readJson;

    this.options = { ...options };
    delete this.options["fetch"];
    delete this.options["readJson"];
  }

  async fetchTrialSetup(metadataURL, password, options = {}) {
    const collect = options.namedItems ?? CODEX_INDEXED_ITEMS;
    const codex = await this.fetchTrialSetupCodex(
      metadataURL,
      password,
      options
    );
    const trialSetup = {};
    for (const name of collect)
      trialSetup[name] = codex.objectFromData(
        codex.getIndexedItem(name, { ikey: 0 })
      );
    return trialSetup;
  }

  /**
   * See {@link readTrialSetupCodex} this *requires* that furniture is present or supplied via a disc file
   *
   * @param {string} filename
   * @param {string} password
   * @param {{furnitureFilename?}} options
   * @returns
   */
  readTrialSetup(filename, password, options = {}) {
    const collect = options.namedItems ?? CODEX_INDEXED_ITEMS;
    const codex = this.readTrialSetupCodex(filename, password, options);
    return this._trialSetupFromCodex(codex, collect);
  }

  /**
   * See {@link trialSetupFromCollection}, reads the codex  the pulls out the trial setup object
   * @param {string} filename
   * @param {string} password
   * @param {{furnitureFilename?,ikeys?}} options see {@link BlobCodex.derivePasswordKeys} regarding ikeys
   */
  trialSetupFromCollection(filename, password, options = {}) {
    const collect = options.namedItems ?? CODEX_INDEXED_ITEMS;
    const codex = this.trialSetupFromCollectionCodex(
      filename,
      password,
      options
    );
    return this._trialSetupFromCodex(codex, collect);
  }

  _trialSetupFromCodex(codex, collect = CODEX_INDEXED_ITEMS) {
    const trialSetup = {};
    for (const name of collect) {
      if (!codex.hasIndexedItem(name))
        throw new Error(`codex missing expected item ${name}`);
      trialSetup[name] = codex.objectFromData(
        codex.getIndexedItem(name, { ikey: 0 })
      );
    }
    return trialSetup;
  }

  /**
   * @param {string} filename
   * @param {string} password  - blobs are stored clear text if password is set null
   * @param {{furnitureFilename?,ikeys?}} options see {@link BlobCodex.derivePasswordKeys} regarding ikeys
   * @returns
   */
  async trialSetupFromCollectionCodex(filename, password, options = {}) {
    const collection = this.readJson(filename);
    const furnitureFilename =
      options.furnitureFilename ?? this.options.furnitureFilename;

    const mapName = options.mapName ?? Object.keys(collection).sort()[0];

    const codex = new BlobCodex();
    await codex.derivePasswordKeys([password], options);

    for (const [name, map] of Object.entries(collection)) {
      if (name !== mapName) continue;
      codex.addItem(codex.dataFromObject(map), {
        content_type: "application/json",
        name,
      });
    }

    if (!furnitureFilename) return codex;

    const furniture = this.readJson(furnitureFilename);
    codex.addItem(codex.dataFromObject(furniture), {
      name: CODEX_FURNITURE_INDEX,
    });
    return codex;
  }

  /**
   *
   * @param {*} metadataURL
   * @param {string} password the password needed to decrypt the trial setup
   * blob codex. Note that password=null is supported for cases where the
   * creator did not encrypt the setup data. ikeys are not necessary if the
   * trialsetup was saved in the conventional way but can be passed via options.
   * @param {{ikeys?,ipfsGatewayUrl?,ipfsAuthToken?}} options
   */
  async fetchTrialSetupCodex(metadataURL, password, options = {}) {
    const data = await this.fetchTrialSetupJson(metadataURL, options);
    return BlobCodex.hydrate(data, [password]);
  }

  /**
   * Read a secret blobcodex and require that it has the requisite items for a trialsetup.
   *
   * @param {string} filename
   * @param {string} password the password needed to decrypt the trial setup
   * blob codex. Note that password=null is supported for cases where the
   * creator did not encrypt the setup data. ikeys are not necessary if the
   * trialsetup was saved in the conventional way but can be passed via options.
   * @param {{furnitureFilename?}} options if the codex identified by {@link filename} does not contain furniture, furnitureFilename is *required* here (or on the constructor options)
   */
  async readTrialSetupCodex(filename, password, options = {}) {
    if (!this.readJson)
      throw new Error(
        `a readJson implementation must be provided in the constructor options to use the read* methods`
      );
    const data = this.readJson(filename);
    const codex = await BlobCodex.hydrate(data, [password], options);
    if (codex.hasIndexedItem(CODEX_FURNITURE_INDEX)) return codex;

    const furnitureFilename =
      options.furnitureFilename ?? this.options.furnitureFilename;
    if (!furnitureFilename)
      throw new Error(
        `trialsetup metadata property was missing the dungeon furniture and a disc filename has not been provided`
      );
    const furniture = this.readJson(furnitureFilename);
    codex.addItem(codex.dataFromObject(furniture), {
      name: CODEX_FURNITURE_INDEX,
    });
    return codex;
  }

  /**
   * readTrailSetupJson reads the json data from the trialsetup property on the game metadata.
   *
   * @param {string} metadataURL the ipfs url for the game nft metadata
   * @param {{ipfsGatewayUrl?,ipfsAuthToken?}} options
   */
  async fetchTrialSetupJson(metadataURL, options = {}) {
    const data = await this.fetchJson(metadataURL);
    const trialSetupURL = data.properties?.trialsetup?.ipfs;
    if (!trialSetupURL)
      throw new Error(`trialsetup property missing or malformed in metadata`);

    return await this.fetchJson(data.properties.trialsetup.ipfs);
  }

  /**
   *
   * @param {string} ipfsURL  ipfs scheme url
   * @param {{ipfsGatewayUrl?,ipfsAuthToken?}} options
   * @returns
   */
  async fetchJson(ipfsURL, options = {}) {
    if (!this.fetch)
      throw new Error(
        `a fetch implementation must be provided in the constructor options to use the fetch* methods`
      );
    const data = ipfsFetchJSON(this.fetch, ipfsURL, {
      ...this.options,
      options,
    });
    return data;
  }
}
