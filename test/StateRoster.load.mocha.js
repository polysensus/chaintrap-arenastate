import hre from "hardhat";
const ethers = hre.ethers;
import * as msgpack from "@msgpack/msgpack";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import {getGameCreated, getSetMerkleRoot} from "./support/minter.js";
//
import { EventParser } from "../src/lib/arenaevents/eventparser.js";
import { ArenaEvent, findGameEvents } from "../src/lib/arenaevents/arenaevent.js";
import { Transactor } from "../src/lib/arenaevents/transactor.js";
import { StateRoster } from "../src/lib/stateroster.js";

import { Trial } from "../src/lib/trial.js";

import { ABIName2 } from "../src/lib/abiconst.js"

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

    const roster = new StateRoster(gid, {});
    // const changes = new RosterStateChange();
    // const txmemo = new TxMemo();

    for (const log of await findGameEvents(this.arena, gid)) {
      const event = arenaEvents.parse(log);
      let msg = event.name;
      if (event.gid) {
        msg = `${msg}: ${event.gid.toHexString()}`
      }
      console.log(msg);

      expect(event).to.exist;
      roster.applyEvent(event);
    }
  });
});
