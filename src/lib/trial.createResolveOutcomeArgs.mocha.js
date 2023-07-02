// @ts-check
import { expect } from "chai";

import * as msgpack from "@msgpack/msgpack";

import { LogicalTopology } from "./maptrie/logical.js";
//
// import maps from "../../../data/maps/map02.json" assert { type: "json" };
// const { map02 } = maps;

import { Trial } from "./trial.js";
import { getGameCreated } from "./arenaevent.js";
import { ArenaEvent } from "./arenaevent.js";
import { EventParser } from "./chainkit/eventparser.js";
import { Transactor } from "./chainkit/transactor.js";
import { numberToGid } from "./gid.js";

describe("Trial createResolveOutcomeArgs tests", function () {
  it("Should create a gid", function () {
    const gid = numberToGid(1);
    const x = gid.toHexString();
    expect(gid.toHexString()).to.equal("0x0400000000000000000000000000000001");
  });

  it("Should resolve a location exit choice", async function () {
    if (!this.gameOptions || !this.mintGame) {
      this.skip();
    }

    const topo = new LogicalTopology();
    topo.extendJoins([{ joins: [0, 1], sides: [3, 1] }]); // rooms 0,1 sides EAST, WEST
    topo.extendLocations([
      { sides: [[], [], [], [0]], flags: {} },
      { sides: [[], [0], [], []], flags: {} },
    ]);
    const trial = new Trial({ topology: topo });
    trial.topology.commit();

    // mint without publishing nft metadata
    let r = await this.mintGame({ topology: topo, trie: trial.topology.trie });

    const startLocationId = 0;

    const arenaEvents = new EventParser(this.arena, ArenaEvent.fromParsedEvent);
    const gid = getGameCreated(r, arenaEvents).gid;

    // TODO: sort out once createCommitArgs is implemented on trial
    let inputIndex = trial.topology.locationChoices[
      startLocationId
    ].leaf.matchInput([3, 0]);
    let inputs = trial.topology.locationChoicesPrepared[startLocationId][1];
    let choice = inputs[inputIndex];

    const startArgs = trial.createStartGameArgs(
      [startLocationId],
      this.minter.minter.initArgs.rootLabels[0]
    );

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
        rootLabel: this.minter.minter.initArgs.rootLabels[0],
        input: choice,
        data: "0x",
      })
      .requireLogs(
        "TranscriptEntryCommitted(uint256,address,uint256,bytes32,uint256,bytes)"
      );

    // TODO: get the participant commit working - its a ref to the last input value
    for await (const r of transactor.transact()) {
      console.log(
        Object.keys(r.events).map((name) => `${name}[${r.events[name].length}]`)
      );
    }

    const user1Address = await this.user1Arena.signer.getAddress();
    const resolveArgs = trial.createResolveOutcomeArgs(
      user1Address,
      startLocationId,
      choice
    );

    transactor = new Transactor(arenaEvents);
    transactor
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
  });
});
