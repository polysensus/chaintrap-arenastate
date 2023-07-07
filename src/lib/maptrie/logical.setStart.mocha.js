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
import { Furniture } from "../map/furniture.js";
import { ObjectType } from "../maptrie/objecttypes.js";

const { map02 } = maps;

describe("LogicalTopology setStart tests", function () {
  it("Should prove set start", async function () {
    if (!this.gameOptions || !this.mintGame) {
      this.skip();
    }

    // build and verify a proof stack showing that a specific location exits are bound to exit menu choice inputs
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

    // mint without publishing nft metadata
    this.minter.applyOptions({
      choiceInputTypes: [ObjectType.LocationChoices],
      transitionTypes: [ObjectType.Link2, ObjectType.Finish],
      victoryTransitionTypes: [ObjectType.Finish],
    });
    let r = await this.mintGame({ topology: topo, trie: trie });

    const trial = new Trial(
      ethers.BigNumber.from(1),
      this.minter.options.mapRootLabel,
      {
        map: undefined,
        topology: topo,
        trie,
      }
    );

    const arenaEvents = new EventParser(this.arena, ArenaEvent.fromParsedEvent);
    const gid = getGameCreated(r, arenaEvents).gid;
    let transactor = new Transactor(arenaEvents);

    const startArgs = trial.createStartGameArgs([0]);
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
