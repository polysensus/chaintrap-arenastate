/**
 * A json file format for storing AES encrypted blobs.
 */

import { ethers } from "ethers";
const ethersb64decode = ethers.utils.base64.decode;
const ethersb64encode = ethers.utils.base64.encode;

import {
  createCipher,
  createDecipher,
  deriveAESKey,
  DEFAULT_AES_ALG,
} from "./aespbkdf.js";

export const NULL_KEY = "<cleartext>";

/**
 * The codex is used to accumulate a collection of individually encrypted items.
 * Each item in the collection corresponds to a single piece of input data along
 * with some meta data. The input data and most of the meta data is encoded as
 * an encrypted 'blob' under one or more of the password derived keys.
 *
 * There are expected uses are:
 *  1. The passwords are session tokens and they are securely exchanged (diffie
 *     helman or something) with individual game participants at the start of a
 *     game session.
 *  2. For storage of game maps. In this case, the passwords *may* be revealed
 *     to on more more participants if the game map ownership is transferred. Or
 *     they may never be revealed at all.
 *  3. A single key held by the creator and never revealed. In this case
 *     especially, you should consider setting a custom (and higher) iteration
 *     value as this use typically indicates the data should be secret over the
 *     long term.
 *
 * Note that the default attack resistance for the derived keys isn't set
 * very high. This is inconsideration of the data already being partially
 * revealed through normal on chain activity.
 *
 * @param {password} passwords a single AES key is derived for each password
 * and an encrypted blob is created for each key by addBlob
 */
export class BlobCodex {
  /**
   * @constructor
   * @param {*} mode
   * @param {*} options
   */
  constructor(options = {}) {
    this.options = { ...options };
    this.keys = {};
    this.options.alg = DEFAULT_AES_ALG; // don't allow anything else
    this.index = {};
    this.items = [];
    this._itemsClearText = {};
  }

  serialize() {
    // object item iteration order is not well defined.
    const ikeys = [];
    const keys = [];
    const salts = [];
    let iKeyMax = 0;
    for (const i of Object.keys(this.keys).map(Number).sort()) {
      let { key, salt } = this.keys[i];
      if (i > iKeyMax) iKeyMax = i;
      ikeys.push(i);
      keys.push(key);
      if (salt !== null) salt = ethersb64encode(salt);
      salts.push(salt);
    }

    const s = {
      ikeys,
      salts,
      index: structuredClone(this.index),
      items: structuredClone(this.items),
    };

    return s;
  }

  /**
   *
   * @param {{salts, index, items, ikeys?}} s
   * @param {*} passwords
   * @param {*} options
   */
  static async hydrate(s, passwords, options = {}) {
    const codex = new BlobCodex(options);
    const have = codex
      .optionsIKeys(passwords, { ikeys: s.ikeys })
      .reduce((x, i) => {
        x[i] = true;
        return x;
      }, {});
    const want = codex.optionsIKeys(passwords, options);
    for (const i of want)
      if (!have[i])
        throw new Error(
          `want key index ${i}, but it wasn't found in the serialized data`
        );

    const salts = want.reduce((salts, i) => {
      salts[i] = s.salts[i] !== null ? ethersb64decode(s.salts[i]) : null;
      return salts;
    }, {});

    await codex.derivePasswordKeys(passwords, { ikeys: want, salts });

    for (const item of s.items) {
      const id = Object.keys(codex.items).length;
      if (id != item.id)
        throw new Error(`expected id ${id} != item id ${item.id}`);
      codex.items.push(item);
      const { name } = item;
      if (name) {
        const entries = codex.index[name] ?? [];
        entries.push(id);
        codex.index[name] = entries;
      }
      if (options.decrypt) {
        // all blobs are identical content so we only ever need to de-crypt one
        // of them.  the only reason we support multiple ikeys for hydrate is so
        // that we can re-encrypt under the same keys as before.
        codex.getItem(id, want[0]);
      }
    }
    return codex;
  }

  optionsIKeys(passwords, options) {
    let ikeys = options?.ikeys;
    if (!ikeys) {
      // this is the identity case, typically the creator of the data will hit this case.
      ikeys = [];
      for (let i = 0; i < passwords.length; i++) ikeys.push(i);
    }
    if (ikeys.length < passwords.length)
      throw new Error(
        `key indices provided, but not enough. leave for the default behaviour or provide one for each password`
      );

    return ikeys;
  }

  /**
   * @param {password} passwords a single AES key is derived for each password
   * @param {{ikeys?}} optional mapping of passwords to key indices, used when decrypting.
   */
  async derivePasswordKeys(passwords, options = {}) {
    let ikeys = this.optionsIKeys(passwords, options);

    const salts = options?.salts;
    if (salts && Object.keys(salts).length != passwords.length)
      throw new Error("number of salts inconsistent with provided passwords");

    for (let i = 0; i < passwords.length; i++) {
      if (passwords[i] === null) {
        this.keys[ikeys[i]] = { salt: null, key: null };
        continue;
      }
      const deriveOpts = { ...this.options };

      if (options.iterations) deriveOpts.iterations = options.iterations;
      if (salts) deriveOpts.salt = salts[ikeys[i]];

      const { salt, key } = await deriveAESKey(passwords[i], deriveOpts);

      this.keys[ikeys[i]] = { salt, key };
    }
  }

  /**
   *
   * @param {*} ikeys
   * @param {*} options
   * @returns {{}}
   */
  createCiphers(ikeys, options = {}) {
    if (!this.keys)
      throw new Error("the key must be derived before calling this method");

    // do all the keys by default
    if (typeof ikeys === "undefined") {
      ikeys = [];
      Object.keys(this.keys).forEach((v, i) => ikeys.push(i));
    }

    // If its a single number, convert to a list
    if (typeof ikeys === "number") ikeys = [ikeys];

    return ikeys.map((ikey) => {
      const { key } = this.keys[ikey];
      if (key === null) return { cipher: null, ikey };

      if (!key) throw new Error(`bad key index ${ikey}`);
      return {
        ...createCipher(key, {
          ...this.options,
          ...options,
          alg: this.options.alg,
        }),
        ikey,
      };
    });
  }

  dataFromObject(o) {
    return Buffer.from(JSON.stringify(o));
  }

  objectFromData(data) {
    return JSON.parse(data);
  }

  hasIndexedItem(name) {
    return name in this.index;
  }

  /**
   *
   * @param {*} id
   * @param {{ikey?,which?}} options
   */
  getIndexedItem(name, options = {}) {
    const ids = this.index[name];
    if (!ids) throw new Error(`name ${name} is not in the index`);

    let { ikey, which } = options;
    if (typeof which === "undefined") which = 0;

    return this.getItem(ids[which], ikey);
  }

  getItem(id, ikey = undefined) {
    let data = this._itemsClearText[id];
    if (data) return data;
    if (typeof ikey === "undefined")
      throw new Error(
        `a key index is required if the clear text is not in the cache`
      );

    const item = this.items[id];

    for (const blob of item.blobs) {
      if (blob.params.ikey !== ikey) continue;

      const { key } = this.keys[blob.params.ikey];

      let data;
      if (key === null) {
        data = Buffer.from(ethersb64decode(blob.blob));
      } else {
        if (!key)
          throw new Error(
            `invalid key index in blob ${i} item ${[item.id, item.name]}`
          );

        const decipher = createDecipher(key, {
          iv: ethersb64decode(blob.params.iv),
          alg: blob.params.alg,
          tag: ethersb64decode(blob.params.tag),
        });
        data = decipher.update(ethersb64decode(blob.blob));
        data = Buffer.concat([data, decipher.final()]);
      }

      // NOTICE: the format *requires* that each blob for an item is *exactly*
      // the same content. An item has multiple blobs to permit encrypting under
      // different keys in order to support selective reveal.
      this._itemsClearText[id] = data;
      return data;
    }
    return undefined;
  }

  addItem(data, meta, ikeys = undefined) {
    if (!this.keys)
      throw new Error("you must derive a key before calling this method");

    const id = this.items.length;
    const blobs = [];

    let { name, labels } = meta ?? {};

    for (const { cipher, iv, ikey } of this.createCiphers(ikeys)) {
      if (cipher === null) {
        // then storing in plain text. so having any keys at all is only useful
        // if the blobs are being distributed and stored independently of the
        // blobcodex.
        blobs.push({
          params: { ikey },
          blob: ethersb64encode(data),
        });
        continue;
      }

      let blob = cipher.update(data);
      blob = Buffer.concat([blob, cipher.final()]);

      blobs.push({
        params: {
          ikey,
          iv: ethersb64encode(iv),
          alg: this.options.alg,
          tag: ethersb64encode(cipher.getAuthTag()),
        },
        blob: ethersb64encode(blob),
      });
    }

    // Note the password is derived once so the salt applies to all, but we use
    // a distinct  iv for each blob.
    const item = {
      id,
      name,
      labels,
      meta,
      blobs,
    };
    this.items.push(item);
    this._itemsClearText[id] = data;

    if (name) {
      const entries = this.index[name] ?? [];
      entries.push(id);
      this.index[name] = entries;
    }
    return { id, item };
  }
}
