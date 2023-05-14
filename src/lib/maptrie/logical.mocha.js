// @ts-check
import { expect } from "chai";

import { ethers } from "ethers";

import { LogicalTopology } from "./logical.js";
import { LinkLeaf } from "./leaves.js";
import { Link } from "./link.js";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
//
import maps from "../../../data/maps/map02.json" assert { type: "json" };
const { map02 } = maps;

describe("LogicalTopology tests", function () {
  it("Should build merkle for standard test map map", function () {
    const topo = new LogicalTopology();
    topo.extendJoins(map02.model.corridors); // rooms 0,1 sides EAST, WEST
    topo.extendLocations(map02.model.rooms);

    const trie = topo.encodeTrie();

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
      { sides: [[], [], [], [0]], flags: {} },
      { sides: [[], [0], [], []], flags: {} },
    ]);

    const trie = topo.encodeTrie();
    for (const [i, v] of trie.entries()) {
      const proof = trie.getProof(i);
      console.log("Value:", v);
      console.log("Proof:", proof);
    }
  });

  it("Should throw because join and location access disagree", function () {
    const topo = new LogicalTopology();
    topo.extendJoins([{ joins: [0, 1], sides: [3, 1] }]); // rooms 0,1 sides EAST, WEST
    topo.extendLocations([
      { sides: [[], [], [], [0]], flags: {} },
      { sides: [[], [3], [], []], flags: {} },
    ]);

    // Note the which=0 end of the join is fine
    const access = topo.joinAccess(0, 0);
    expect(access.location).to.equal(0);
    expect(access.side).to.equal(3);
    expect(access.exit).to.equal(0);

    // But the location referred to by the which=1 end doesn't have an entry in
    // the access list for the side corresponding to the join.
    expect(() => topo.joinAccess(0, 1)).to.throw(
      /join 0 does not have a corresponding access/
    );
  });

  it("Should return join access for minimal two location topology", function () {
    const topo = new LogicalTopology();
    topo.extendJoins([{ joins: [0, 1], sides: [3, 1] }]); // rooms 0,1 sides EAST, WEST
    topo.extendLocations([
      { sides: [[], [], [], [0]], flags: {} },
      { sides: [[], [0], [], []], flags: {} },
    ]);

    let access = topo.joinAccess(0, 0);
    expect(access.location).to.equal(0);
    expect(access.side).to.equal(3);
    expect(access.exit).to.equal(0);

    access = topo.joinAccess(0, 1);
    expect(access.location).to.equal(1);
    expect(access.side).to.equal(1);
    expect(access.exit).to.equal(0);
  });

  it("Should error because the join is not referenced by the location it indicates", function () {
    const topo = new LogicalTopology();

    // @ts-ignore
    expect(() => topo.joinAccess(0, 3)).to.throw(/which must be 0 or 1, not 3/);
    expect(() => topo.joinAccess(1, 0)).to.throw(/join index 1 is out.*/);
  });

  it("Should error because which or join i is out of range", function () {
    const topo = new LogicalTopology();
    // @ts-ignore
    expect(() => topo.joinAccess(0, 3)).to.throw(/which must be 0 or 1, not 3/);
    expect(() => topo.joinAccess(1, 0)).to.throw(/join index 1 is out.*/);
  });

  it("Should throw because the join entry is badly formatted", function () {
    const topo = new LogicalTopology();

    // @ts-ignore
    expect(() => topo.extendJoins([{}])).to.throw(
      /badly structured join object/
    );
  });

  it("Should throw because the location entry is badly formatted", function () {
    const topo = new LogicalTopology();

    // @ts-ignore
    expect(() => topo.extendLocations([{}])).to.throw(
      /badly structured location object/
    );
  });
});
