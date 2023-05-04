// @ts-check
import { describe, it, expect } from "vitest";

import { ethers } from "ethers";

import { LogicalTopology } from "./logical.js";
import { LinkLeaf } from "./leaves.js";
import { Link } from "./link.js";

import maps from "../map/mocks/map02.json" assert { type: "json" };
const { map02 } = maps;

describe("LogicalTopology tests", function () {
  it("Should build merkle for standard test map map", function () {
    const topo = new LogicalTopology();
    topo.extendJoins(map02.model.corridors); // rooms 0,1 sides EAST, WEST
    topo.extendLocations(map02.model.rooms);

    const trie = topo.buildMerkleTrie();
    for (const [i, v] of trie.entries()) {
      const proof = trie.getProof(i);
      console.log("Value:", v);
      console.log("Proof:", proof);
    }
  });

  it("Should build merkle for two room single join map", function () {
    const topo = new LogicalTopology();
    topo.extendJoins([{ joins: [0, 1], sides: [3, 1] }]); // rooms 0,1 sides EAST, WEST
    topo.extendLocations([
      { joins: [[], [], [], [0]], flags: {} },
      { joins: [[], [0], [], []], flags: {} },
    ]);

    const trie = topo.buildMerkleTrie();
    for (const [i, v] of trie.entries()) {
      const proof = trie.getProof(i);
      console.log("Value:", v);
      console.log("Proof:", proof);
    }
  });

  it("Should abi encode access using Link", function () {
    // location, side, exit 48 bits

    const topo = new LogicalTopology();
    topo.extendJoins([{ joins: [0, 1], sides: [3, 1] }]); // rooms 0,1 sides EAST, WEST
    topo.extendLocations([
      { joins: [[], [], [], [0]], flags: {} },
      { joins: [[], [0], [], []], flags: {} },
    ]);

    const arrayLink = topo.link(0);
    const link = new Link().setArrayLink(arrayLink);

    const encoded = link.encode();

    const decoded = Link.decode(encoded);

    expect(arrayLink[0][0]).to.equal(decoded?.a?.location);
    expect(arrayLink[0][1]).to.equal(decoded?.a?.side);
    expect(arrayLink[0][2]).to.equal(decoded?.a?.access);

    expect(arrayLink[1][0]).to.equal(decoded?.b?.location);
    expect(arrayLink[1][1]).to.equal(decoded?.b?.side);
    expect(arrayLink[1][2]).to.equal(decoded?.b?.access);
  });

  it("Should abi encode access using LinkLeaf", function () {
    // location, side, exit 48 bits

    const topo = new LogicalTopology();
    topo.extendJoins([{ joins: [0, 1], sides: [3, 1] }]); // rooms 0,1 sides EAST, WEST
    topo.extendLocations([
      { joins: [[], [], [], [0]], flags: {} },
      { joins: [[], [0], [], []], flags: {} },
    ]);

    const link = topo.link(0);
    const encoded = ethers.utils.defaultAbiCoder.encode(LinkLeaf.ABI, link);

    const decoded = ethers.utils.defaultAbiCoder.decode(LinkLeaf.ABI, encoded);

    expect(link[0][0]).to.equal(decoded[0].location);
    expect(link[0][1]).to.equal(decoded[0].side);
    expect(link[0][2]).to.equal(decoded[0].access);

    expect(link[1][0]).to.equal(decoded[1].location);
    expect(link[1][1]).to.equal(decoded[1].side);
    expect(link[1][2]).to.equal(decoded[1].access);
  });

  it("Should throw because join and location access disagree", function () {
    const topo = new LogicalTopology();
    topo.extendJoins([{ joins: [0, 1], sides: [3, 1] }]); // rooms 0,1 sides EAST, WEST
    topo.extendLocations([
      { joins: [[], [], [], [0]], flags: {} },
      { joins: [[], [3], [], []], flags: {} },
    ]);

    // Note the which=0 end of the join is fine
    const access = topo.whichAccessForJoin(0, 0);
    expect(access[0]).to.equal(0);
    expect(access[1]).to.equal(3);
    expect(access[2]).to.equal(0);

    // But the location referred to by the which=1 end doesn't have an entry in
    // the access list for the side corresponding to the join.
    expect(() => topo.whichAccessForJoin(0, 1)).toThrow(
      /join 0 does not have a corresponding access/
    );
  });

  it("Should return join access for minimal two location topology", function () {
    const topo = new LogicalTopology();
    topo.extendJoins([{ joins: [0, 1], sides: [3, 1] }]); // rooms 0,1 sides EAST, WEST
    topo.extendLocations([
      { joins: [[], [], [], [0]], flags: {} },
      { joins: [[], [0], [], []], flags: {} },
    ]);

    let access = topo.whichAccessForJoin(0, 0);
    expect(access[0]).to.equal(0);
    expect(access[1]).to.equal(3);
    expect(access[2]).to.equal(0);

    access = topo.whichAccessForJoin(0, 1);
    expect(access[0]).to.equal(1);
    expect(access[1]).to.equal(1);
    expect(access[2]).to.equal(0);
  });

  it("Should error because the join is not referenced by the location it indicates", function () {
    const topo = new LogicalTopology();

    // @ts-ignore
    expect(() => topo.whichAccessForJoin(0, 3)).toThrow(
      /which must be 0 or 1, not 3/
    );
    expect(() => topo.whichAccessForJoin(1, 0)).toThrow(
      /join index 1 is out.*/
    );
  });

  it("Should error because which or join i is out of range", function () {
    const topo = new LogicalTopology();
    // @ts-ignore
    expect(() => topo.whichAccessForJoin(0, 3)).toThrow(
      /which must be 0 or 1, not 3/
    );
    expect(() => topo.whichAccessForJoin(1, 0)).toThrow(
      /join index 1 is out.*/
    );
  });

  it("Should throw because the join entry is badly formatted", function () {
    const topo = new LogicalTopology();

    // @ts-ignore
    expect(() => topo.extendJoins([{}])).toThrow(
      /badly structured join object/
    );
  });

  it("Should throw because the location entry is badly formatted", function () {
    const topo = new LogicalTopology();

    // @ts-ignore
    expect(() => topo.extendLocations([{}])).toThrow(
      /badly structured location object/
    );
  });
});
