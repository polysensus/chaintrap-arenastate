import hre from "hardhat";
const ethers = hre.ethers;
import * as msgpack from "@msgpack/msgpack";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { getGameCreated, getSetMerkleRoot } from "./support/minter.js";
//
import { EventParser } from "../src/lib/chainkit/eventparser.js";
import {
  ArenaEvent,
  findGameEvents,
} from "../src/lib/arenaevent.js";
import { Transactor } from "../src/lib/chainkit/transactor.js";
import { StateRoster } from "../src/lib/stateroster.js";

import { Trial } from "../src/lib/trial.js";

import { ABIName } from "../src/lib/abiconst.js";

describe("StateRoster# load", async function () {
  before(async function () {
    if (!this.gameOptions || !this.mintFixture) {
      this.skip();
    }
  });

  it("Should start single player game and prove first move", async function () {
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

    const roster = new StateRoster(gid, {});
    // const changes = new RosterStateChange();
    // const txmemo = new TxMemo();

    for (const log of await findGameEvents(this.arena, gid)) {
      const event = arenaEvents.parse(log);
      let msg = event.name;
      if (event.gid) {
        msg = `${msg}: ${event.gid.toHexString()}`;
      }
      console.log(msg);

      expect(event).to.exist;
      roster.applyEvent(event);
    }

    const p = roster.players[user1Address];
    const current = p.current();
    const delta = p.delta();
    const outcome = p.outcome();

    for (const state of [current, delta, outcome]) {
      expect(state.address).to.equal(user1Address);
      expect(state.registered).to.be.true;
      expect(state.profile?.nickname).to.equal("alice");
      expect(state.node).to.equal(userChoice);
      expect(state.rootLabel).to.equal(rootLabel);
    }
  });
});
