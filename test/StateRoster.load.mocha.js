import hre from "hardhat";
const ethers = hre.ethers;
import * as msgpack from "@msgpack/msgpack";
import { expect } from "chai";
import { LogicalTopology } from "../src/lib/maptrie/logical.js";
import { conditionInputs } from "../src/lib/maptrie/objects.js";
import { LocationChoices } from "../src/lib/maptrie/locationchoices.js";

import { getGameCreated, getSetMerkleRoot } from "../src/lib/arenaevent.js";
//
import { EventParser } from "../src/lib/chainkit/eventparser.js";
import { ArenaEvent, findGameEvents } from "../src/lib/arenaevent.js";
import { Transactor } from "../src/lib/chainkit/transactor.js";
import { StateRoster } from "../src/lib/stateroster.js";

import { Trial } from "../src/lib/trial.js";

import { ABIName } from "../src/lib/abiconst.js";
describe("StateRoster# load", async function () {
  it("Should start single player game and prove first move", async function () {
    if (!this.gameOptions || !this.mintGame) {
      this.skip();
    }

    const topo = new LogicalTopology();
    topo.extendJoins([{ joins: [0, 1], sides: [3, 1] }]); // rooms 0,1 sides EAST, WEST
    topo.extendLocations([
      { sides: [[], [], [], [0]], flags: {} },
      { sides: [[], [0], [], []], flags: {} },
    ]);
    const trial = new Trial({topology: topo})
    trial.topology.commit();

    // mint without publishing nft metadata
    let r = await this.mintGame({ topology: topo, trie: trial.topology.trie });

    const startLocationId = 0;


    const user1Address = await this.user1Arena.signer.getAddress();

    // this.minter.loadMap();
    // const trial = Trial.fromCollectionJSON(this.minter.collection);
    let inputIndex = trial.topology.locationChoices[startLocationId].leaf.matchInput([3, 0]);
    let inputs = trial.topology.locationChoicesPrepared[startLocationId][1];
    let userChoice = inputs[inputIndex];

    const arenaEvents = new EventParser(this.arena, ArenaEvent.fromParsedEvent);
    const gid = getGameCreated(r, arenaEvents).gid;
    const rootLabel = getSetMerkleRoot(r, arenaEvents).parsedLog.args.label;

    const startArgs = trial.createStartGameArgs([startLocationId], this.minter.minter);

    let transactor = new Transactor(arenaEvents);
    transactor
      .method(
        this.user1Arena.registerTrialist,
        gid,
        msgpack.encode({ nickname: "alice" })
      )
      .requireLogs("TranscriptRegistration(uint256,address,bytes)")
      .method(this.guardianArena.startTranscript, gid, startArgs)
      .requireLogs(
        "TranscriptStarted(uint256)",
        "TranscriptEntryChoices(uint256,address,uint256,(uint256,bytes32[][]),bytes)"
      )
      .method(this.user1Arena.transcriptEntryCommit, gid, {
        rootLabel,
        input: userChoice,
        data: "0x",
      })
      .requireLogs(
        "TranscriptEntryCommitted(uint256,address,uint256,bytes32,uint256,bytes)"
      )
      .method(
        this.guardianArena.transcriptEntryResolve,
        gid,
        trial.createResolveOutcomeArgs(user1Address, startLocationId, userChoice)
      )
      .requireLogs(
        "TranscriptEntryChoices(uint256,address,uint256,(uint256,bytes32[][]),bytes)",
        "TranscriptEntryOutcome(uint256,address,uint256,address,bytes32,uint8,bytes)"
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
      expect(state.rootLabel).to.equal(rootLabel);
      expect(state.inputChoice.toNumber() === 1);
      let a = state.choices.inputs[LocationChoices.CHOICE_INPUTS];
      let b = conditionInputs([[1, 0]])[0];
      expect(b.length).to.equal(2);
      expect(a[0]).to.equal(b[0]);
      expect(a[1]).to.equal(b[1]);
    }
  });
});
