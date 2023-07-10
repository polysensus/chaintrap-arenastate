import { expect } from "chai";
import {
  createCipher,
  createDecipher,
  deriveAESKey,
  DEFAULT_AES_ALG,
} from "./aespbkdf.js";

import { BlobCodex } from "./secretblobs.js";

describe("Secret blob tests", function () {
  it("Should round trip basic data encryption", async function () {
    const password = "not very secret";
    const theMessage = "the message";
    const { key, salt } = await deriveAESKey(password);
    const { cipher, iv, alg } = createCipher(key);
    let enc = cipher.update(theMessage);
    enc = Buffer.concat([enc, cipher.final()]);

    const tag = cipher.getAuthTag();
    const decodeKeys = await deriveAESKey(password, { salt });
    // const decipher = createDecipher(key, {iv, alg, tag});
    const decipher = createDecipher(decodeKeys.key, { iv, alg, tag });

    let dec = decipher.update(enc);
    dec = Buffer.concat([dec, decipher.final()]);
    let decodedMessage = String.fromCharCode(...dec);
    expect(decodedMessage).to.equal(theMessage);
  });
  it("Should create a blob codec with no options", function () {
    const codec = new BlobCodex();
    expect(codec.options.alg).to.equal(DEFAULT_AES_ALG);
  });
  it("Should derive one key", async function () {
    const codec = new BlobCodex();
    expect(codec.options.alg).to.equal(DEFAULT_AES_ALG);
    await codec.derivePasswordKeys(["very secret"]);
    expect(Object.keys(codec.keys).length).to.equal(1);
  });
  it("Should create ciphers for all keys by default", async function () {
    const codec = new BlobCodex();
    expect(codec.options.alg).to.equal(DEFAULT_AES_ALG);
    await codec.derivePasswordKeys(["very secret", "another secret"]);
    expect(Object.keys(codec.keys).length).to.equal(2);

    const ciphers = await codec.createCiphers();
    expect(ciphers.length).to.equal(2);
  });

  it("Should blob under specific indexed key", async function () {
    const codec = new BlobCodex();
    expect(codec.options.alg).to.equal(DEFAULT_AES_ALG);
    await codec.derivePasswordKeys(["very secret", "another secret"]);

    const data = codec.dataFromObject({ foo: 1, bar: "the bar" });

    const { id, item } = codec.addItem(data, { name: "foobar" }, 1);
    expect(id).to.equal(0);
    expect(item.blobs.length).to.equal(1);
    expect(item.blobs[0].params.ikey).to.equal(1);
  });

  it("Should blob and unblob under one key", async function () {
    const codec = new BlobCodex();
    expect(codec.options.alg).to.equal(DEFAULT_AES_ALG);
    const password0 = "very secret";
    await codec.derivePasswordKeys([password0]);

    const data = codec.dataFromObject({ foo: 1, bar: "the bar" });

    const { id, item } = codec.addItem(data, { name: "foobar" }, 0);
    expect(id).to.equal(0);
    expect(item.blobs.length).to.equal(1);
    expect(item.blobs[0].params.ikey).to.equal(0);

    const s = codec.serialize();

    const hydrated = await BlobCodex.hydrate(s, [password0], { ikeys: [0] });
    expect(hydrated.items.length).to.equal(codec.items.length);
  });

  it("Should blob and unblob under specific indexed key", async function () {
    const codec = new BlobCodex();
    expect(codec.options.alg).to.equal(DEFAULT_AES_ALG);

    const password0 = "very secret";
    const password1 = "another secret";
    await codec.derivePasswordKeys([password0, password1]);

    const data = codec.dataFromObject({ foo: 1, bar: "the bar" });

    const { id, item } = codec.addItem(data, { name: "foobar" }, 1);
    expect(id).to.equal(0);
    expect(item.blobs.length).to.equal(1);
    expect(item.blobs[0].params.ikey).to.equal(1);

    const s = codec.serialize();

    const hydrated = await BlobCodex.hydrate(s, [password1], { ikeys: [1] });
    expect(hydrated.items.length).to.equal(codec.items.length);
    const value = hydrated.items[0].blobs[0].value;
    expect(value.foo).to.equal(1);
    expect(value.bar).to.equal("the bar");
  });
});
