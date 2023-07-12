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

  it("Should getItem by id after adding", async function () {
    const codex = new BlobCodex();
    expect(codex.options.alg).to.equal(DEFAULT_AES_ALG);

    const password0 = "very secret";
    const password1 = "another secret";
    await codex.derivePasswordKeys([password0, password1]);

    const data = codex.dataFromObject({ foo: 1, bar: "the bar" });

    const { id, item } = codex.addItem(data, { name: "foobar" }, 1);
    // getItem without ikey as the item should be available in the clear
    const got = JSON.parse(codex.getItem(id));

    expect(got.foo).to.equal(1);
    expect(got.bar).to.equal("the bar");
  });

  it("Should blob and unblob under specific indexed key", async function () {
    const codex = new BlobCodex();
    expect(codex.options.alg).to.equal(DEFAULT_AES_ALG);

    const password0 = "very secret";
    const password1 = "another secret";
    await codex.derivePasswordKeys([password0, password1]);

    const data = codex.dataFromObject({ foo: 1, bar: "the bar" });

    const { id, item } = codex.addItem(data, { name: "foobar" }, 1);
    expect(id).to.equal(0);
    expect(item.blobs.length).to.equal(1);
    expect(item.blobs[0].params.ikey).to.equal(1);

    const s = codex.serialize();

    const hydrated = await BlobCodex.hydrate(s, [password1], { ikeys: [1] });
    expect(hydrated.items.length).to.equal(codex.items.length);

    // we didn't set decrypt in the options so the plaintext should not be in the cache
    expect(hydrated._itemsClearText[id]).to.not.exist;

    // getItem with ikey of the only key we provided to hydrate
    const got = JSON.parse(hydrated.getItem(id, 1));

    expect(got.foo).to.equal(1);
    expect(got.bar).to.equal("the bar");
  });

  it("Should unblob indexed item", async function () {
    const codex = new BlobCodex();
    expect(codex.options.alg).to.equal(DEFAULT_AES_ALG);

    const password0 = "very secret";
    const password1 = "another secret";
    await codex.derivePasswordKeys([password0, password1]);

    const data = codex.dataFromObject({ foo: 1, bar: "the bar" });

    const { id, item } = codex.addItem(data, { name: "foobar" }, 1);
    expect(id).to.equal(0);
    expect(item.blobs.length).to.equal(1);
    expect(item.blobs[0].params.ikey).to.equal(1);

    const s = codex.serialize();

    const hydrated = await BlobCodex.hydrate(s, [password1], { ikeys: [1] });
    expect(hydrated.items.length).to.equal(codex.items.length);

    // we didn't set decrypt in the options so the plaintext should not be in the cache
    expect(hydrated._itemsClearText[id]).to.not.exist;

    // getItem with ikey of the only key we provided to hydrate
    const got = JSON.parse(hydrated.getIndexedItem("foobar", { ikey: 1 }));

    expect(got.foo).to.equal(1);
    expect(got.bar).to.equal("the bar");
  });

  it("Should decyrpt on hydrate", async function () {
    const codex = new BlobCodex();
    expect(codex.options.alg).to.equal(DEFAULT_AES_ALG);

    const password0 = "very secret";
    const password1 = "another secret";
    await codex.derivePasswordKeys([password0, password1]);

    const data = codex.dataFromObject({ foo: 1, bar: "the bar" });

    const { id, item } = codex.addItem(data, { name: "foobar" }, 1);
    expect(id).to.equal(0);
    expect(item.blobs.length).to.equal(1);
    expect(item.blobs[0].params.ikey).to.equal(1);

    const s = codex.serialize();

    const hydrated = await BlobCodex.hydrate(s, [password1], {
      ikeys: [1],
      decrypt: true,
    });
    expect(hydrated.items.length).to.equal(codex.items.length);

    // if the decrypt was successful, the data is in the clear text cache
    const got = JSON.parse(hydrated._itemsClearText[id]);

    expect(got.foo).to.equal(1);
    expect(got.bar).to.equal("the bar");
  });

  it("Should have empty clear text cache after hydrating without decrypt flag", async function () {
    const codex = new BlobCodex();
    expect(codex.options.alg).to.equal(DEFAULT_AES_ALG);

    const password0 = "very secret";
    const password1 = "another secret";
    await codex.derivePasswordKeys([password0, password1]);

    const data = codex.dataFromObject({ foo: 1, bar: "the bar" });

    const { id, item } = codex.addItem(data, { name: "foobar" }, 1);

    // check the plaintext value exists on the original, else this test is meaningless
    expect(Object.keys(codex._itemsClearText).length).to.equal(1);

    const s = codex.serialize();

    const hydrated = await BlobCodex.hydrate(s, [password1], { ikeys: [1] });
    expect(Object.keys(hydrated._itemsClearText).length).to.equal(0);
  });

  it("Should encode and decode with null key", async function () {
    const codex = new BlobCodex();
    expect(codex.options.alg).to.equal(DEFAULT_AES_ALG);

    const password0 = "very secret";
    await codex.derivePasswordKeys([password0, null]);

    const data = codex.dataFromObject({ foo: 1, bar: "the bar" });

    const { id, item } = codex.addItem(data, { name: "foobar" }, 1);
    expect(id).to.equal(0);
    expect(item.blobs.length).to.equal(1);
    expect(item.blobs[0].params.ikey).to.equal(1);

    const s = codex.serialize();

    const hydrated = await BlobCodex.hydrate(s, [null], {
      ikeys: [1],
      decrypt: true,
    });
    expect(hydrated.items.length).to.equal(codex.items.length);

    // if the decrypt was successful, the data is in the clear text cache
    const got = JSON.parse(hydrated._itemsClearText[id]);

    expect(got.foo).to.equal(1);
    expect(got.bar).to.equal("the bar");
  });
});
