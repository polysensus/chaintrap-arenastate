// @ts-check
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { ethers } from "ethers";
import * as msgpack from "@msgpack/msgpack";

const zeroPad = ethers.utils.zeroPad;
const hexlify = ethers.utils.hexlify;
const keccak256 = ethers.utils.keccak256;
const abiCoder = ethers.utils.defaultAbiCoder;

import { LogicalTopology } from "./logical.js";
import { LogicalRef, LogicalRefType } from "./logicalref.js";
//
import maps from "../../../data/maps/map02.json" assert { type: "json" };
import {
  ObjectCodec,
  LeafObject,
  leafHash,
  directPreimage,
  conditionInputs,
} from "./objects.js";
import { ObjectType } from "./objecttypes.js";
import { ExitMenu } from "./exitmenu.js";
import { LocationMenu } from "./locationscene.js";
import { LocationExit } from "./locationexit.js";
import { LocationLink } from "./locationlink.js";

import { getGameCreated, getSetMerkleRoot } from "../arenaevent.js";
import { ArenaEvent } from "../arenaevent.js";
import { EventParser } from "../chainkit/eventparser.js";
import { Transactor } from "../chainkit/transactor.js";

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

  it("Should encode exitMenu proofs", function () {
    const topo = new LogicalTopology();
    topo.extendJoins([{ joins: [0, 1], sides: [3, 1] }]); // rooms 0,1 sides EAST, WEST
    topo.extendLocations([
      { sides: [[], [], [], [0]], flags: {} },
      { sides: [[], [0], [], []], flags: {} },
    ]);
    const trie = topo.encodeTrie();

    // lets just be sure we get exceptions for obviously incorrect leaves
    expect(() => trie.getProof([12345, "0x123456"])).to.throw();
    // expect(() => trie.getProof(prepared)).to.throw(); sanity test

    // Show that we can get proofs linking the two locations via the described exits

    // Show the exit menus referenced by each location are in the trie
    let lo = new LeafObject({
      type: ObjectType.ExitMenu,
      leaf: new ExitMenu([[0], [0], [0], [1]]),
    });
    // let [typeId, inputs] = ObjectCodec.typePrepare[lo.type](lo.leaf);
    // let preimage = directPreimage(inputs);

    // using the machinery in LogicalTopology
    let prepared = topo.prepareLeaf(lo);
    let proof = trie.getProof(prepared);
    expect(proof.length).to.be.greaterThan(0);

    // And also from first principals
    prepared = [ObjectType.ExitMenu, directPreimage(conditionInputs([[3, 0]]))]; // side 3 (east), exit 0
    let proof1 = trie.getProof(prepared);

    // belt and braces the first time
    for (let i = 0; i < proof.length; i++) expect(proof[i]).to.equal(proof1[i]);

    lo = new LeafObject({
      type: ObjectType.ExitMenu,
      leaf: new ExitMenu([[0], [1], [0], [0]]),
    });
    prepared = topo.prepareLeaf(lo);

    // Show that each location is provably associated with its exit menu
    proof = trie.getProof(prepared);
    expect(proof.length).to.be.greaterThan(0);

    prepared = [ObjectType.ExitMenu, directPreimage(conditionInputs([[1, 0]]))]; // side 1 (west), exit 0
    proof = trie.getProof(prepared);
    expect(proof.length).to.be.greaterThan(0);
  });

  it("Should encode location association with exitMenu proofs", function () {
    const topo = new LogicalTopology();
    topo.extendJoins([{ joins: [0, 1], sides: [3, 1] }]); // rooms 0,1 sides EAST, WEST
    topo.extendLocations([
      { sides: [[], [], [], [0]], flags: {} },
      { sides: [[], [0], [], []], flags: {} },
    ]);
    const trie = topo.encodeTrie();

    // Show that we can get proofs linking the two locations via the described exits

    // Show the exit menus referenced by each location are in the trie
    let lo = new LeafObject({
      type: ObjectType.ExitMenu,
      leaf: new ExitMenu([[0], [0], [0], [1]]),
    });
    // let [typeId, inputs] = ObjectCodec.typePrepare[lo.type](lo.leaf);
    // let preimage = directPreimage(inputs);

    // using the machinery in LogicalTopology
    let prepared = topo.prepareLeaf(lo);
    let proof = trie.getProof(prepared);
    expect(proof.length).to.be.greaterThan(0);

    // And also from first principals
    prepared = [ObjectType.ExitMenu, directPreimage(conditionInputs([[3, 0]]))]; // side 3 (east), exit 0
    proof = trie.getProof(prepared);
    expect(proof.length).to.be.greaterThan(0);

    const locationMenu = new LocationMenu(
      0,
      new LogicalRef(LogicalRefType.Proof, ObjectType.ExitMenu, 0, undefined)
    );
    lo = new LeafObject({ type: ObjectType.Location2, leaf: locationMenu });
    prepared = topo.prepareLeaf(lo);
    proof = trie.getProof(prepared);
    expect(proof.length).to.be.greaterThan(0);

    // And also from first principals, to be sure the encodings are what we intended
    let exitMenuKey = leafHash([
      ObjectType.ExitMenu,
      directPreimage(conditionInputs([[3, 0]])),
    ]);

    prepared = [
      ObjectType.Location2,
      directPreimage(conditionInputs([[0], [exitMenuKey]])),
    ];
    proof = trie.getProof(prepared);
    expect(proof.length).to.be.greaterThan(0);

    // Now do the other location
    exitMenuKey = leafHash([
      ObjectType.ExitMenu,
      directPreimage(conditionInputs([[1, 0]])),
    ]);

    prepared = [
      ObjectType.Location2,
      directPreimage(conditionInputs([[1], [exitMenuKey]])),
    ];
    proof = trie.getProof(prepared);
    expect(proof.length).to.be.greaterThan(0);
  });

  it("Should encode location exit associations and location links", function () {
    const topo = new LogicalTopology();
    topo.extendJoins([{ joins: [0, 1], sides: [3, 1] }]); // rooms 0,1 sides EAST, WEST
    topo.extendLocations([
      { sides: [[], [], [], [0]], flags: {} },
      { sides: [[], [0], [], []], flags: {} },
    ]);
    const trie = topo.encodeTrie();

    let id;

    let key = leafHash(
      topo.prepareLeaf(
        new LeafObject({
          type: ObjectType.ExitMenu,
          leaf: topo.locationExitMenu(0),
        })
      )
    );
    id = topo.exitMenuKeys[key];

    let refExitMenu0InputS3E0 = topo.referenceProofInput(
      ObjectType.ExitMenu,
      id,
      { side: 3, exit: 0 }
    );
    const refL0 = new LogicalRef(LogicalRefType.Proof, ObjectType.Location2, 0);

    key = leafHash(
      topo.prepareLeaf(
        new LeafObject({
          type: ObjectType.ExitMenu,
          leaf: topo.locationExitMenu(1),
        })
      )
    );
    id = topo.exitMenuKeys[key];
    let refExitMenu1InputS1E0 = topo.referenceProofInput(
      ObjectType.ExitMenu,
      id,
      { side: 1, exit: 0 }
    );
    const refL1 = new LogicalRef(LogicalRefType.Proof, ObjectType.Location2, 1);

    let egressExitL0 = new LeafObject({
      type: LocationExit.ObjectType,
      leaf: new LocationExit(refExitMenu0InputS3E0, refL0),
    });

    id = topo.exitKeys[leafHash(topo.prepareLeaf(egressExitL0))];
    let refL0S3E0 = new LogicalRef(LogicalRefType.Proof, ObjectType.Exit, id);

    let ingressExitL1 = new LeafObject({
      type: LocationExit.ObjectType,
      leaf: new LocationExit(refExitMenu1InputS1E0, refL1),
    });
    id = topo.exitKeys[leafHash(topo.prepareLeaf(ingressExitL1))];
    let refL1S1E0 = new LogicalRef(LogicalRefType.Proof, ObjectType.Exit, id);

    const lo = new LeafObject({
      type: LocationLink.ObjectType,
      leaf: new LocationLink(refL0S3E0, refL1S1E0),
    });

    let prepared = topo.prepareLeaf(lo);
    let proof = trie.getProof(prepared);
    expect(proof.length).to.be.greaterThan(0);
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
