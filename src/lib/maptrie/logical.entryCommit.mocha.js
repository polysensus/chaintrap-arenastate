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

describe("LogicalTopology entryCommit tests", function () {
  it("Should commit location exit choice", async function () {
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

    // --- Exit Menu EM (egress)
    const exitMenuObject0 = new LeafObject({
      type: ObjectType.ExitMenu,
      leaf: topo.locationExitMenu(0),
    });
    const exitMenuPrepared0 = topo.prepareLeaf(exitMenuObject0);
    let exitMenuKey = leafHash(exitMenuPrepared0);
    let id = topo.exitMenuKeys[exitMenuKey];

    // --- Location L (egress)
    let exitMenuIndex = 0;
    let locationMenu = new LocationMenu(
      0, // location id
      new LogicalRef(LogicalRefType.Proof, ObjectType.ExitMenu, exitMenuIndex)
    );
    const locationMenuObject0 = new LeafObject({
      type: LocationMenu.ObjectType,
      leaf: locationMenu,
    });

    // --- Location L (ingress)
    exitMenuIndex = 1;
    locationMenu = new LocationMenu(
      1, // location id
      new LogicalRef(LogicalRefType.Proof, ObjectType.ExitMenu, exitMenuIndex)
    );
    const locationMenuObject1 = new LeafObject({
      type: LocationMenu.ObjectType,
      leaf: locationMenu,
    });

    // --- Exit E (egress)
    let refMenuInput = topo.referenceProofInput(ObjectType.ExitMenu, id, {
      side: 3,
      exit: 0,
    });
    let refLocation = new LogicalRef(
      LogicalRefType.Proof,
      ObjectType.Location2,
      0
    );

    let egressExit = new LeafObject({
      type: LocationExit.ObjectType,
      leaf: new LocationExit(refMenuInput, refLocation),
    });
    let preparedExit = topo.prepareLeaf(egressExit);

    let egressChoices = [
      {
        typeId: ObjectType.Exit,
        inputs: egressExit.leaf.inputs({
          resolveValue: topo.resolveValueRef.bind(topo),
        }),
      },
    ];

    let egressProofs = [trie.getProof(preparedExit)];

    let x = abiCoder.encode(LeafObject.ABI, preparedExit);
    console.log(`encoded:(preparedExit) ${hexlify(x)}`);
    console.log(`leafHash: ${leafHash(preparedExit)}`);
    console.log(egressProofs[0]);

    // let x = abiCoder.encode(
    //   LeafObject.ABI, exitMenuPrepared0);
    // console.log(`encoded:(leaves[-1]) ${hexlify(x)}`);

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

    // the input is [[menuInput], [location]]
    let choice = egressChoices[0].inputs[0][1];

    // --- Exit Menu EM (ingress)
    let ingressExitMenuKey = leafHash(
      topo.prepareLeaf(
        new LeafObject({
          type: ObjectType.ExitMenu,
          leaf: topo.locationExitMenu(1),
        })
      )
    );

    // --- Exit E (ingress)
    id = topo.exitMenuKeys[ingressExitMenuKey];
    refMenuInput = topo.referenceProofInput(ObjectType.ExitMenu, id, {
      side: 1,
      exit: 0,
    });
    refLocation = new LogicalRef(LogicalRefType.Proof, ObjectType.Location2, 1);
    let ingressExit = new LeafObject({
      type: LocationExit.ObjectType,
      leaf: new LocationExit(refMenuInput, refLocation),
    });
    let preparedIngressExit = topo.prepareLeaf(ingressExit);
    let ingressChoice = [
      {
        typeId: ObjectType.Exit,
        inputs: ingressExit.leaf.inputs({
          resolveValue: topo.resolveValueRef.bind(topo),
        }),
      },
    ];
    let ingressProof = [trie.getProof(preparedIngressExit)];

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
      )
      .method(this.user1Arena.transcriptEntryCommit, gid, {
        rootLabel: this.minter.minter.initArgs.rootLabels[0],
        node: choice,
        data: "0x",
      })
      .requireLogs(
        "TranscriptEntryCommitted(uint256,address,uint256,bytes32,bytes32,bytes)"
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

    const stackProofInputRef = (istack, jinput) => {
      const hi = ethers.BigNumber.from(istack);
      const lo = ethers.BigNumber.from(jinput);
      hi.shl(16);
      // Note: just assume lo doesn't need masking off for test convenience
      return hi.or(lo).toHexString();
    };

    // Let the player start location id be 0 (the first location added above)

    let startId = 0;

    // Let the player chose the first exit on the east side.
    // The value commit (above) is the REF(p(SCENE),i) input value from the
    choice = 0; // input 0 is [3, 0]

    // Obtain a proof for the egress exit menu
    let proof = trie.getProof(exitMenuPrepared0);
    // let key = leafHash(prepared);

    // Set STACK(0) to exitMenu referenced by L0
    leaves.push({
      typeId: exitMenuPrepared0[0],
      inputs: exitMenuPrepared0[1],
    });
    stack.push({
      inputRefs: [],
      proofRefs: [],
      rootLabel: this.minter.minter.initArgs.rootLabels[0],
      proof,
    });

    x = abiCoder.encode(LeafObject.ABI, [
      leaves[leaves.length - 1].typeId,
      leaves[leaves.length - 1].inputs,
    ]);
    console.log(`encoded:(leaves[-1]) ${hexlify(x)}`);
    console.log(`leafHash: ${leafHash(exitMenuPrepared0)}`);
    console.log("proof", proof);

    x = abiCoder.encode(LeafObject.ABI, exitMenuPrepared0);
    console.log(`encoded:(exitMenuPrepared0) ${hexlify(x)}`);
    console.log("");

    // Obtain a proof linking the exit menu to L0
    // [LOCATION, [[locationId], [REF(#EM)]]]

    let prepared = topo.prepareLeaf(locationMenuObject0);
    proof = trie.getProof(prepared);
    // STACK(1) to the association of location 0 with exitMenu 0
    leaves.push({
      typeId: ObjectType.Location2,
      inputs: [[zeroPad(hexlify(0), 32)], [zeroPad(hexlify(0), 32)]],
    });
    stack.push({
      inputRefs: [],
      proofRefs: [1], // mark input[1] as reference to proven leaf node
      rootLabel: this.minter.minter.initArgs.rootLabels[0],
      proof,
    });
    x = abiCoder.encode(LeafObject.ABI, [
      leaves[leaves.length - 1].typeId,
      leaves[leaves.length - 1].inputs,
    ]);
    console.log(`encoded:(leaves[-1]) ${hexlify(x)}`);
    console.log(`leafHash: ${leafHash(prepared)}`);
    console.log("proof", proof);
    x = abiCoder.encode(LeafObject.ABI, prepared);
    console.log(`encoded:(LOCATION)) ${hexlify(x)}`);
    console.log("");

    // now add the proofs for the destination location, the ingress exit and the the choices at that location.

    // Obtain an exit proof linking the exit menu choice to a specific location exit
    // [EXIT, [[REF(#S, i)], [REF(#L)]]]
    proof = trie.getProof(preparedExit);
    // STACK(2) to the association of exit 0 with location 0 with exitMenu 0, choice 0.
    // note that the location proof is at STACK(1)
    leaves.push({
      typeId: ObjectType.Exit,
      inputs: conditionInputs([[0, 0], [1]]),
    });
    stack.push({
      inputRefs: [0],
      proofRefs: [1],
      rootLabel: this.minter.minter.initArgs.rootLabels[0],
      proof,
    });

    x = abiCoder.encode(LeafObject.ABI, [
      leaves[leaves.length - 1].typeId,
      leaves[leaves.length - 1].inputs,
    ]);
    console.log(`encoded:(leaves[-1]) ${hexlify(x)}`);
    console.log(`leafHash: ${leafHash(preparedExit)}`);
    console.log("proof", proof);
    x = abiCoder.encode(LeafObject.ABI, preparedExit);
    console.log(`encoded:(EXIT)) ${hexlify(x)}`);
    console.log("");

    // finally, reveal (and prove) the outcome and choices consequent from the player choice
    const user1Address = await this.user1Arena.signer.getAddress();

    transactor = new Transactor(arenaEvents);
    transactor
      .method(this.guardianArena.transcriptEntryResolve, gid, {
        participant: user1Address,
        outcome: 3, // Accepted
        stack,
        leaves,
        data: "0x",
        choiceLeafIndex: 0, // XXX: TODO add proofs for the egress / ingress link and the ingress / menu link
      })
      .requireLogs(
        "TranscriptEntryChoices(uint256,address,uint256,bytes32[],bytes)",
        "TranscriptEntryOutcome(uint256,address,uint256,address,bytes32,uint8,bytes32,bytes)"
      );

    // TODO: get the participant commit working
    for await (const r of transactor.transact()) {
      console.log(
        Object.keys(r.events).map((name) => `${name}[${r.events[name].length}]`)
      );
    }

    /*

*/

    // exitMenuKey is the the leaf for exit 0 (the start position of the player)
  });
});
