// @ts-check
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { ethers } from "ethers";
import * as msgpack from "@msgpack/msgpack";

const zeroPad = ethers.utils.zeroPad;
const keccak256 = ethers.utils.keccak256;
const hexlify = ethers.utils.hexlify;
const abiCoder = ethers.utils.defaultAbiCoder;

import { LogicalTopology } from "./logical.js";
//
import maps from "../../../data/maps/map02.json" assert { type: "json" };
import { LeafObject, leafHash, conditionInputs } from "./objects.js";
import { ObjectType } from "./objecttypes.js";
import { readBinaryData } from "../../commands/data.js";
import { readBinaryData } from "../../commands/data.js";

import { getGameCreated, getSetMerkleRoot } from "../arenaevent.js";
import { ArenaEvent } from "../arenaevent.js";
import { EventParser } from "../chainkit/eventparser.js";
import { Transactor } from "../chainkit/transactor.js";
import { Furniture } from "../map/furniture.js";
import { Guardian } from "../guardian.js";

const { map02 } = maps;

describe("LogicalTopology entryCommit tests", function () {
  it("Should resolve a location exit choice", async function () {
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
    topo.placeFurniture(furniture);
    const trie = topo.commit();
    const gameIconBytes = readBinaryData("gameicons/game-ico-1.png");

    let r = await this.mintGame({ topology: topo, trie });

    const arenaEvents = new EventParser(this.arena, ArenaEvent.fromParsedEvent);
    const gid = getGameCreated(r, arenaEvents).gid;
    let transactor = new Transactor(arenaEvents);

    // location
    const location0 = topo.leaf(ObjectType.LocationChoices, 0);
    const location0Prepared = topo.prepareLeaf(location0);
    const location0Proof = trie.getProof(location0Prepared);
    const location0Exit = topo.leaf(ObjectType.Exit, topo.exitId(0, 3, 0));
    const location0ExitPrepared = topo.prepareLeaf(location0Exit);
    const location0ExitProof = trie.getProof(location0ExitPrepared);

    const location1 = topo.leaf(ObjectType.LocationChoices, 1);
    const location1Prepared = topo.prepareLeaf(location1);
    const location1Proof = trie.getProof(location1Prepared);
    const location1Exit = topo.leaf(ObjectType.Exit, topo.exitId(1, 1, 0));
    const location1ExitPrepared = topo.prepareLeaf(location1Exit);
    const location1ExitProof = trie.getProof(location1ExitPrepared);
    const link = topo.leaf(ObjectType.Link2, topo.exitId(0, 3, 0));
    const linkPrepared = topo.prepareLeaf(link);
    const linkProof = trie.getProof(linkPrepared);

    const logit = (name, prepared, proof) => {
      // remember, the inputs are indirect, so prepared != inputs
      console.log(`leafHash: ${leafHash(prepared)}`);
      console.log("proof", proof);
      let x = abiCoder.encode(LeafObject.ABI, prepared);
      console.log(`encoded:(${name})) ${hexlify(x)}`);
      console.log("");
    };

    let egressChoices = [
      {
        typeId: location0Prepared[0],
        inputs: location0Prepared[1],
      },
    ];

    let egressProofs = [location0Proof];

    const startArgs = [
      {
        rootLabel: this.gameInitArgs.rootLabels[0],
        choices: egressChoices,
        proofs: egressProofs,
        data: [msgpack.encode({ sides: [[], [], [], [0]] })],
      },
    ];

    // the input is [[location], [side, exit], ... [side, exit]]
    let choice = egressChoices[0].inputs[location0.leaf.iChoices() + 0];

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
      .method(this.guardianArena.startTranscript, gid, startArgs[0])
      .requireLogs(
        "TranscriptStarted(uint256)",
        "TranscriptEntryChoices(uint256,address,uint256,(uint256,bytes32[][]),bytes)"
      )
      .method(this.user1Arena.transcriptEntryCommit, gid, {
        rootLabel: this.gameInitArgs.rootLabels[0],
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

    // The guardian will know the current location id for all players. To
    // confirm a player exit choice the guardian must prove that the public
    // player choice selects an exit in the current location that is linked to
    // an exit in the next.

    // For maximum 'fog' the locations would be blinded uniquely for each
    // participant, and the relations would be duplicated in the trie for all
    // players.

    let leaves = [];
    let stack = [];

    // Let the player start location id be 0 (the first location added above)

    // Set STACK(0) to location0
    leaves.push({
      typeId: location0Prepared[0],
      inputs: location0Prepared[1],
    });
    stack.push({
      inputRefs: [],
      proofRefs: [],
      rootLabel: this.gameInitArgs.rootLabels[0],
      proof: location0Proof,
    });

    logit("location0", location0Prepared, stack[stack.length - 1]);

    // Set STACK(1) to EXIT proof
    // Obtain an exit proof linking the exit menu choice to a specific location exit
    // [EXIT, [[REF(#L, i)]]]
    // STACK(1) to the association of exit 0 with location 0 with exitMenu 0, choice 0.
    // note that the location proof is at STACK(0)
    leaves.push({
      typeId: location0ExitPrepared[0],
      inputs: conditionInputs([[0, 1]]),
    });
    stack.push({
      inputRefs: [0],
      proofRefs: [],
      rootLabel: this.gameInitArgs.rootLabels[0],
      proof: location0ExitProof,
    });

    logit("EXIT", location0ExitPrepared, location0ExitProof);

    // Set STACK(2) to location1
    leaves.push({
      typeId: location1Prepared[0],
      inputs: location1Prepared[1],
    });
    stack.push({
      inputRefs: [],
      proofRefs: [],
      rootLabel: this.gameInitArgs.rootLabels[0],
      proof: location1Proof,
    });

    logit("location1", location1Prepared, stack[stack.length - 1]);

    // Set STACK(3) to location 1 exit (ingress)
    leaves.push({
      typeId: location1ExitPrepared[0],
      inputs: conditionInputs([[2, 1]]),
    });
    stack.push({
      inputRefs: [0],
      proofRefs: [],
      rootLabel: this.gameInitArgs.rootLabels[0],
      proof: location1ExitProof,
    });

    // Set STACK(4) to link  exit (stack 1), exit (stack 3)
    leaves.push({
      typeId: linkPrepared[0],
      inputs: conditionInputs([
        [1], // STACK(1)
        [3], // STACK(3)
      ]),
    });
    stack.push({
      inputRefs: [],
      proofRefs: [0, 1],
      rootLabel: this.gameInitArgs.rootLabels[0],
      proof: linkProof,
    });

    // finally, reveal (and prove) the outcome and choices consequent from the player choice
    const user1Address = await this.user1Arena.signer.getAddress();

    transactor = new Transactor(arenaEvents);
    transactor
      .method(this.guardianArena.transcriptEntryResolve, gid, {
        participant: user1Address,
        outcome: 3, // Accepted
        proof: {
          choiceSetType: 9,
          transitionType: 8,
          stack,
          leaves,
        },
        data: "0x",
        choiceLeafIndex: 2, // XXX: TODO add proofs for the egress / ingress link and the ingress / menu link
      })
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
