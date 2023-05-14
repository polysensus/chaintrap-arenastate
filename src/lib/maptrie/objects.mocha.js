// @ts-check
import { ethers } from "ethers";
import { expect } from "chai";

import { Access } from "./access.js";
import { Link } from "./link.js";

import { ObjectType, ObjectCodec, LeafObject } from "./objects.js";

describe("Object trie Access tests", function () {
  it("Should encode and decode an access type", function () {
    const access = new Access({ location: 2, side: 3, exit: 4 });
    const o = new LeafObject({ type: ObjectType.Access, leaf: access });
    const data = ObjectCodec.prepare(o);
    const decoded = ObjectCodec.hydrate({ type: data[0], leaf: data[1] });
    // // const access = [2, 3, 4];
    // const data = Access.encode(access);
    // const decoded = Access.decode(data);
    expect(decoded.leaf.location).to.equal(access.location);
    expect(decoded.leaf.side).to.equal(access.side);
    expect(decoded.leaf.exit).to.equal(access.exit);
  });

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
    const prepared = ObjectCodec.prepare(leafObject);
    encoded = ethers.utils.defaultAbiCoder.encode(LeafObject.ABI, prepared);
    decoded = ethers.utils.defaultAbiCoder.decode(LeafObject.ABI, encoded);
    const hydrated = ObjectCodec.hydrate(decoded);
    expect(hydrated.leaf.a.location).to.equal(a.location);
    expect(hydrated.leaf.a.side).to.equal(a.side);
    expect(hydrated.leaf.a.exit).to.equal(a.exit);

    expect(hydrated.leaf.b.location).to.equal(b.location);
    expect(hydrated.leaf.b.side).to.equal(b.side);
    expect(hydrated.leaf.b.exit).to.equal(b.exit);

    // const xencoded0 = ethers.utils.defaultAbiCoder.encode(["uint16 type", "bytes leaf"], [{type:2, leaf:"0x1234"}]);
  });
});
