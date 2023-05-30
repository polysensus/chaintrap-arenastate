import hre from "hardhat";
const ethers = hre.ethers;
import * as msgpack from "@msgpack/msgpack";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import {getGameCreated, getSetMerkleRoot} from "./support/minter.js";
import { Trial } from "../src/lib/trial.js";
import { ArenaEvent } from "../src/lib/arenaevents/arenaevent.js";
import { EventParser } from "../src/lib/arenaevents/eventparser.js";
import { Transactor } from "../src/lib/arenaevents/transactor.js";

describe("Trial# startGame", async function () {
  before(async function () {
    if (!this.gameOptions || !this.mintFixture) {
      this.skip();
    }
  });
  it("Should startGame for two trialists", async function () {
    const trial = Trial.fromCollectionJSON(this.minterFixture.collection);
    const { choices, data } = trial.createStartGameArgs([0, 1]);
    expect(choices.length).to.equal(2);
    expect(data.length).to.equal(2);

    let r = await loadFixture(this.mintFixture);
    const arenaEvents = new EventParser(this.arena, ArenaEvent.fromParsedEvent);
    const gid = getGameCreated(r, arenaEvents).gid;

    let transactor = new Transactor(arenaEvents);
    transactor
      .method(
        this.user1Arena.registerParticipant,
        gid,
        msgpack.encode({ nickname: "alice" })
      )
      .requireLogs("ParticipantRegistered(uint256,address,bytes)")
      .method(
        this.user2Arena.registerParticipant,
        gid,
        msgpack.encode({ nickname: "bob" })
      )
      .requireLogs("ParticipantRegistered(uint256,address,bytes)")
      .method(this.guardianArena.startGame2, gid, { choices, data })
      .requireLogs(
        "GameStarted(uint256)",
        "RevealedChoices(uint256,address,uint256,bytes32[],bytes)",
        "RevealedChoices(uint256,address,uint256,bytes32[],bytes)"
      );

    for await (const r of transactor.transact()) {
      console.log(Object.keys(r.events).map(name=>`${name}[${r.events[name].length}]`));
    }
  });

  it("Should prove move for single trialist", async function () {

    const user1Address = await this.user1Arena.signer.getAddress();

    const trial = Trial.fromCollectionJSON(this.minterFixture.collection);
    const { choices, data } = trial.createStartGameArgs([0]);
    expect(choices.length).to.equal(1);
    expect(data.length).to.equal(1);

    const userChoice = choices[0][0];

    let r = await loadFixture(this.mintFixture);
    const arenaEvents = new EventParser(this.arena, ArenaEvent.fromParsedEvent);
    const gid = getGameCreated(r, arenaEvents).gid;
    const rootLabel = getSetMerkleRoot(r, arenaEvents).parsedLog.args.label;

    let transactor = new Transactor(arenaEvents);
    transactor
      .method(
        this.user1Arena.registerParticipant,
        gid,
        msgpack.encode({ nickname: "alice" })
      )
      .requireLogs("ParticipantRegistered(uint256,address,bytes)")
      .method(this.guardianArena.startGame2, gid, { choices, data })
      .requireLogs(
        "GameStarted(uint256)",
        "RevealedChoices(uint256,address,uint256,bytes32[],bytes)"
      )
      .method(this.user1Arena.commitAction, gid, {rootLabel, node: userChoice, data:"0x"})
      .requireLogs(
        "ActionCommitted(uint256,uint256,address,bytes32,bytes32,bytes)"
      )
      .method(this.guardianArena.resolveOutcome, gid,
        trial.createResolveOutcomeArgs(user1Address, userChoice)
      )
      .requireLogs(
        "RevealedChoices(uint256,address,uint256,bytes32[],bytes)",
        "ArgumentProven(uint256,uint256,address)",
        "OutcomeResolved(uint256,uint256,address,address,bytes32,uint8,bytes32,bytes)"
      )
      ;

    for await (const r of transactor.transact()) {
      console.log(Object.keys(r.events).map(name=>`${name}[${r.events[name].length}]`));
    }
  });

});
