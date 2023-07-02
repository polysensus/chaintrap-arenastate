// @ts-check
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { ethers } from "ethers";
import * as msgpack from "@msgpack/msgpack";

import { LogicalTopology } from "./logical.js";
//
import maps from "../../../data/maps/map02.json" assert { type: "json" };

import { getGameCreated } from "../arenaevent.js";
import { ArenaEvent } from "../arenaevent.js";
import { EventParser } from "../chainkit/eventparser.js";
import { Transactor } from "../chainkit/transactor.js";
import { Trial } from "../trial.js";

const { map02 } = maps;

describe("LogicalTopology setStart tests", function () {
  it("Should prove set start", async function () {
    // build and verify a proof stack showing that a specific location exits are bound to exit menu choice inputs
    const topo = new LogicalTopology();
    topo.extendJoins([{ joins: [0, 1], sides: [3, 1] }]); // rooms 0,1 sides EAST, WEST
    topo.extendLocations([
      { sides: [[], [], [], [0]], flags: {} },
      { sides: [[], [0], [], []], flags: {} },
    ]);
    const trial = new Trial({ topology: topo });
    trial.topology.commit();

    // mint without publishing nft metadata
    let r = await this.mintGame({
      topology: trial.topology,
      trie: trial.topology.trie,
    });
    const arenaEvents = new EventParser(this.arena, ArenaEvent.fromParsedEvent);
    const gid = getGameCreated(r, arenaEvents).gid;
    let transactor = new Transactor(arenaEvents);

    const startArgs = trial.createStartGameArgs([0], this.minter.minter.initArgs.rootLabels[0]);
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
      );

    for await (const r of transactor.transact()) {
      console.log(
        Object.keys(r.events).map((name) => `${name}[${r.events[name].length}]`)
      );
    }
  });
});
