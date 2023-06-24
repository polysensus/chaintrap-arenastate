// @ts-check
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { ethers } from "ethers";
import * as msgpack from "@msgpack/msgpack";

const zeroPad = ethers.utils.zeroPad;
const hexlify = ethers.utils.hexlify;
const keccak256 = ethers.utils.keccak256;
const abiCoder = ethers.utils.defaultAbiCoder;

import { LogicalTopology } from "./logical.js";
import { LogicalRef, LogicalRefType } from "./logicalref.js";
//
import maps from "../../../data/maps/map02.json" assert { type: "json" };
import {
  ObjectCodec,
  LeafObject,
  leafHash,
  directPreimage,
  conditionInputs,
} from "./objects.js";
import { ObjectType } from "./objecttypes.js";
import { ExitMenu } from "./exitmenu.js";
import { LocationMenu } from "./locationscene.js";
import { LocationExit } from "./locationexit.js";
import { LocationLink } from "./locationlink.js";

import { getGameCreated, getSetMerkleRoot } from "../arenaevent.js";
import { ArenaEvent } from "../arenaevent.js";
import { EventParser } from "../chainkit/eventparser.js";
import { Transactor } from "../chainkit/transactor.js";

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
    const trie = topo.encodeTrie();

    // mint without publishing nft metadata
    let r = await this.mintGame({ topology: topo, trie });
    const arenaEvents = new EventParser(this.arena, ArenaEvent.fromParsedEvent);
    const gid = getGameCreated(r, arenaEvents).gid;
    let transactor = new Transactor(arenaEvents);

    let key = leafHash(
      topo.prepareLeaf(
        new LeafObject({
          type: ObjectType.ExitMenu,
          leaf: topo.locationExitMenu(0),
        })
      )
    );
    let id = topo.exitMenuKeys[key];

    let refMenuInput = topo.referenceProofInput(ObjectType.ExitMenu, id, {
      side: 3,
      exit: 0,
    });
    const refLocation = new LogicalRef(
      LogicalRefType.Proof,
      ObjectType.Location2,
      0
    );

    let egressExit = new LeafObject({
      type: LocationExit.ObjectType,
      leaf: new LocationExit(refMenuInput, refLocation),
    });
    let prepared = topo.prepareLeaf(egressExit);
    let egressChoices = [
      {
        typeId: ObjectType.Exit,
        inputs: egressExit.leaf.inputs({
          resolveValue: topo.resolveValueRef.bind(topo),
        }),
      },
    ];
    let egressProofs = [trie.getProof(prepared)];

    // id = topo.exitKeys[leafHash(topo.prepareLeaf(egressExit))];
    // let refExit = new LogicalRef(LogicalRefType.Proof, ObjectType.Exit, id);

    const startArgs = [
      {
        rootLabel: this.minter.minter.initArgs.rootLabels[0],
        choices: egressChoices,
        proofs: egressProofs,
        data: [msgpack.encode({ sides: [[], [], [], [0]] })],
      },
    ];

    transactor
      .method(
        this.user1Arena.registerTrialist,
        gid,
        msgpack.encode({ nickname: "alice" })
      )
      .requireLogs("TranscriptRegistration(uint256,address,bytes)")
      .method(this.guardianArena.startTranscript, gid, startArgs[0])
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
