// @ts-check
import { ethers } from "ethers";
import { expect } from "chai";

import { Access } from "./access.js";
import { Link } from "./link.js";

import { ObjectCodec, LeafObject } from "./objects.js";

describe("Object trie Access tests", function () {

  it("Should abi encode a leaf object", function () {
    let encoded, decoded;
    // various examples of possible encodings, an 'x' prefix means it doesn't work
    encoded = ethers.utils.defaultAbiCoder.encode(
      ["uint16", "bytes"],
      [2, "0x1234"]
    );
    encoded = ethers.utils.defaultAbiCoder.encode(
      ["tuple(uint16 type, bytes leaf)"],
      [[2, "0x1234"]]
    );
    encoded = ethers.utils.defaultAbiCoder.encode(
      ["tuple(uint16 type, bytes leaf)"],
      [{ type: 2, leaf: "0x1234" }]
    );
    encoded = ethers.utils.defaultAbiCoder.encode(
      ["uint16 type", "bytes leaf"],
      [2, "0x1234"]
    );
    decoded = ethers.utils.defaultAbiCoder.decode(
      ["uint16 type", "bytes leaf"],
      encoded
    );
    expect(decoded.type).to.equal(2);
    expect(decoded.leaf).to.equal("0x1234");

    const a = { location: 2, side: 3, exit: 4 };
    const b = { location: 5, side: 6, exit: 7 };
    const leafObject = new LeafObject({
      type: 2,
      leaf: new Link(new Access(a), new Access(b)),
    });
    const prepared = ObjectCodec.prepare(leafObject, undefined);
    encoded = ethers.utils.defaultAbiCoder.encode(LeafObject.ABI, prepared);
    decoded = ethers.utils.defaultAbiCoder.decode(LeafObject.ABI, encoded);
  });
});
