import hre from "hardhat";
const ethers = hre.ethers;
import * as msgpack from "@msgpack/msgpack";
import { expect } from "chai";
import { LogicalTopology } from "../src/lib/maptrie/logical.js";
import {
  conditionInputs,
  deconditionInput,
} from "../src/lib/maptrie/objects.js";

import { getGameCreated, getSetMerkleRoot } from "../src/lib/arenaevent.js";
//
import { EventParser } from "../src/lib/chainkit/eventparser.js";
import { ArenaEvent, findGameEvents } from "../src/lib/arenaevent.js";
import { Transactor } from "../src/lib/chainkit/transactor.js";
import { StateRoster } from "../src/lib/stateroster.js";
import { Furniture } from "../src/lib/map/furniture.js";
import { ObjectType } from "../src/lib/maptrie/objecttypes.js";

import { Trial } from "../src/lib/trial.js";

import { ABIName } from "../src/lib/abiconst.js";

import { readBinaryData } from "./support/data.js";
const gameIconBytes = readBinaryData("gameicons/game-ico-1.png");

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

    const furniture = new Furniture({
      map: { name: "test", beta: "0x" },
      items: [
        {
          unique_name: "finish_exit",
          labels: ["victory_condition"],
          type: "finish_exit",
          data: { location: 1, side: 3, exit: 0 },
        },
      ],
    });
    topo.placeFinish(furniture.byName("finish_exit"));

    const trie = topo.commit();

    let r = await this.mintGame({ topology: topo, trie: trie });

    const startLocationId = 0;

    const user1Address = await this.user1Arena.signer.getAddress();

    let inputIndex = topo.locationChoices[startLocationId].leaf.matchInput([
      3, 0,
    ]);
    let inputs = topo.locationChoicesPrepared[startLocationId][1];
    let userChoice = inputs[inputIndex];

    const arenaEvents = new EventParser(this.arena, ArenaEvent.fromParsedEvent);
    const gid = getGameCreated(r, arenaEvents).gid;
    const rootLabel = getSetMerkleRoot(r, arenaEvents).parsedLog.args.label;

    const trial = new Trial(
      ethers.BigNumber.from(1),
      this.mapRootLabel,
      {
        map: undefined,
        topology: topo,
        trie,
      }
    );

    const startArgs = trial.createStartGameArgs([startLocationId]);

    const resolveArgs = trial.createResolveOutcomeArgs(
      user1Address,
      startLocationId,
      userChoice
    );

    let transactor = new Transactor(arenaEvents);
    transactor
      .method(
        this.user1Arena.registerTrialist,
        gid,
        msgpack.encode({ nickname: "alice" })
      )
      .requireLogs(
        "TranscriptRegistration(uint256,address,bytes)",
        "TranscriptParticipantLivesAdded(uint256,address,uint256,uint256)"
      )
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
      .method(this.guardianArena.transcriptEntryResolve, gid, resolveArgs)
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
    // const txmemo = new TransactionHorizon();

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

    const p = roster.trialists[user1Address];
    const current = p.current();
    const delta = p.delta();
    const entryDelta = p.entryDelta();
    expect(entryDelta.location.length).to.equal(1);
    expect(deconditionInput(entryDelta.location[0])).to.equal(1);
    expect(entryDelta.choices[0].length).to.equal(2);
    let b = conditionInputs([[1, 0]])[0];
    expect(entryDelta.choices[0][0]).to.equal(b[0]);
    expect(entryDelta.choices[0][1]).to.equal(b[1]);

    for (const state of [current, delta]) {
      expect(state.address).to.equal(user1Address);
      expect(state.registered).to.be.true;
      expect(state.profile?.nickname).to.equal("alice");
      expect(state.rootLabel).to.equal(rootLabel);
      expect(state.inputChoice === 0); // it gets adjusted to index the state.choices (which drop the location input off the front of the original inputs)
      let b = conditionInputs([[1, 0]])[0];
      expect(state.location.length).to.equal(1);
      expect(deconditionInput(state.location[0])).to.equal(1);
      expect(state.choices[0].length).to.equal(2);
      expect(state.choices[0][0]).to.equal(b[0]);
      expect(state.choices[0][1]).to.equal(b[1]);
    }
  });
});
