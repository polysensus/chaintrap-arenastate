import hre from "hardhat";
const ethers = hre.ethers;
import * as msgpack from "@msgpack/msgpack";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { getGameCreated, getSetMerkleRoot } from "./support/minter.js";
import { Trial } from "../src/lib/trial.js";
import { ArenaEvent } from "../src/lib/arenaevent.js";
import { EventParser } from "../src/lib/chainkit/eventparser.js";
import { Transactor } from "../src/lib/chainkit/transactor.js";

describe("Trial# startTranscript", async function () {
  it("Should startTranscript for two trialists", async function () {
    if (!this.gameOptions || !this.mintGame) {
      this.skip();
    }

    const trial = Trial.fromCollectionJSON(this.minter.collection);
    const { choices, data } = trial.createStartGameArgs([0, 1]);
    expect(choices.length).to.equal(2);
    expect(data.length).to.equal(2);

    let r = await loadFixture(this.mintGame);
    const arenaEvents = new EventParser(this.arena, ArenaEvent.fromParsedEvent);
    const gid = getGameCreated(r, arenaEvents).gid;

    let transactor = new Transactor(arenaEvents);
    transactor
      .method(
        this.user1Arena.registerTrialist,
        gid,
        msgpack.encode({ nickname: "alice" })
      )
      .requireLogs("TranscriptRegistration(uint256,address,bytes)")
      .method(
        this.user2Arena.registerTrialist,
        gid,
        msgpack.encode({ nickname: "bob" })
      )
      .requireLogs("TranscriptRegistration(uint256,address,bytes)")
      .method(this.guardianArena.startTranscript, gid, { choices, data })
      .requireLogs(
        "TranscriptStarted(uint256)",
        "TranscriptEntryChoices(uint256,address,uint256,bytes32[],bytes)",
        "TranscriptEntryChoices(uint256,address,uint256,bytes32[],bytes)"
      );

    for await (const r of transactor.transact()) {
      console.log(
        Object.keys(r.events).map((name) => `${name}[${r.events[name].length}]`)
      );
    }
  });

  it("Should prove move for single trialist", async function () {
    if (!this.gameOptions || !this.mintGame) {
      this.skip();
    }

    const user1Address = await this.user1Arena.signer.getAddress();

    const trial = Trial.fromCollectionJSON(this.minter.collection);
    const { choices, data } = trial.createStartGameArgs([0]);
    expect(choices.length).to.equal(1);
    expect(data.length).to.equal(1);

    const userChoice = choices[0][0];

    let r = await loadFixture(this.mintGame);
    const arenaEvents = new EventParser(this.arena, ArenaEvent.fromParsedEvent);
    const gid = getGameCreated(r, arenaEvents).gid;
    const rootLabel = getSetMerkleRoot(r, arenaEvents).parsedLog.args.label;

    let transactor = new Transactor(arenaEvents);
    transactor
      .method(
        this.user1Arena.registerTrialist,
        gid,
        msgpack.encode({ nickname: "alice" })
      )
      .requireLogs("TranscriptRegistration(uint256,address,bytes)")
      .method(this.guardianArena.startTranscript, gid, { choices, data })
      .requireLogs(
        "TranscriptStarted(uint256)",
        "TranscriptEntryChoices(uint256,address,uint256,bytes32[],bytes)"
      )
      .method(this.user1Arena.transcriptEntryCommit, gid, {
        rootLabel,
        node: userChoice,
        data: "0x",
      })
      .requireLogs(
        "TranscriptEntryCommitted(uint256,address,uint256,bytes32,bytes32,bytes)"
      )
      .method(
        this.guardianArena.transcriptEntryResolve,
        gid,
        trial.createResolveOutcomeArgs(user1Address, userChoice)
      )
      .requireLogs(
        "TranscriptEntryChoices(uint256,address,uint256,bytes32[],bytes)",
        "TranscriptEntryOutcome(uint256,address,uint256,address,bytes32,uint8,bytes32,bytes)"
      );

    for await (const r of transactor.transact()) {
      console.log(
        Object.keys(r.events).map((name) => `${name}[${r.events[name].length}]`)
      );
    }
  });
});
