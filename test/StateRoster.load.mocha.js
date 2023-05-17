import hre from "hardhat";
const ethers = hre.ethers;
import * as msgpack from "@msgpack/msgpack";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// import { standardLeafEncoding } from "@openzeppelin/merkle-tree";

import { ArenaEvents } from "../src/lib/gameevents.js";
import { Link } from "../src/lib/maptrie/link.js";
import { LeafObject } from "../src/lib/maptrie/objects.js";
import { customError } from "../src/lib/chaintrapabi.js";

describe("StateRoster# load tests", async function () {
  before(async function () {
    if (!this.gameOptions || !this.mintFixture) {
      this.skip();
    }
  });

  it("Should load a game", async function () {
    const r = await loadFixture(this.mintFixture);
    expect(r.status).to.equal(1);
  });

  it("Should load another game", async function () {
    let r = await loadFixture(this.mintFixture);

    let gameEvent;

    const arenaEvents = new ArenaEvents(this.arena);
    gameEvent = arenaEvents.receiptLog(
      r,
      "GameCreated(uint256,address,uint256)"
    );
    expect(gameEvent).to.exist;
    const gid = gameEvent.gid; // all game events have the gid

    let tx = await this.user1Arena.registerParticipant(
      gid,
      msgpack.encode({ nickname: "bob" })
    );
    r = await tx.wait();

    gameEvent = arenaEvents.receiptLog(
      r,
      "ParticipantRegistered(uint256,address,bytes)"
    );
    expect(gameEvent).to.exist;

    tx = await this.guardianArena.startGame2(gid);
    r = await tx.wait();
    gameEvent = arenaEvents.receiptLog(r, "GameStarted(uint256)");
    expect(gameEvent).to.exist;

    const topology = this.minterFixture.topology;
    const trie = this.minterFixture.trie;
    const rootLabel = ethers.utils.formatBytes32String(
      this.minterFixture.options.mapRootLabel
    );

    // commit action
    // We don't deal with start positions here. We just pick a random place to
    // start, and generate a proof of traversing the join.
    const startAccess = topology.joinAccess(0, 0);
    const ingressAccess = topology.joinAccess(0, 1);

    const leaf = LeafObject.linkLeaf(new Link(startAccess, ingressAccess));
    const prepared = leaf.prepare();
    const node = trie.leafHash(prepared);

    tx = await this.user1Arena.commitAction(gid, {
      rootLabel,
      node,
      data: "0x",
    });
    r = await tx.wait();
    try {
      gameEvent = arenaEvents.receiptLog(
        r,
        "ActionCommitted(uint256,uint256,address,bytes32,bytes)"
      );
    } catch (err) {
      const custom = customError(err);
      console.log(custom);
    }
    expect(gameEvent).to.exist;
    // resolve outcome

    let iLeaf = trie.leafLookup(prepared);
    let proof = trie.getProof(iLeaf);

    let data = msgpack.encode({
      scene: "you are in a dimly lit room, you see an exit to the ...",
    });

    try {
      tx = await this.guardianArena.resolveOutcome(gid, {
        participant: this.user1Arena.signer.address,
        outcome: 3 /* Accepted */,
        data,
        proof,
        node,
      });
    } catch (err) {
      const custom = customError(err);
      console.log(custom);
    }

    const events = {};
    r = await tx.wait();
    for (const gev of arenaEvents.receiptLogs(r)) {
      if (gev.name === "ArgumentProven") {
        events[gev.name] = gev;
        continue;
      }
      if (gev.name === "OutcomeResolved") {
        events[gev.name] = gev;
      }
    }
    expect(Object.keys(events).length).to.equal(2);
  });
});
