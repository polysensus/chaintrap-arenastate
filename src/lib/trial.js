import { ethers } from "ethers";
// import * as msgpack from "@msgpack/msgpack";
import {
  LeafObject,
  conditionInputs,
  deconditionInput,
  leafHash,
} from "./maptrie/objects.js";
import { ObjectType } from "./maptrie/objecttypes.js";
import { LocationChoiceType } from "./maptrie/inputtypes.js";
import { TranscriptOutcome } from "./abiconst.js";
import { Furnishing } from "./map/furnishing.js";
import { Furniture } from "./map/furniture.js";
import { LogicalTopology, rootLabel } from "./maptrie/logical.js";

export const CODEX_MAP_INDEX = "map";
export const CODEX_FURNITURE_INDEX = "furniture";
export const CODEX_SVG_INDEX = "svg";
export const CODEX_COMMITTED_INDEX = "committed";
export const CODEX_INDEXED_ITEMS = [
  CODEX_MAP_INDEX,
  CODEX_FURNITURE_INDEX,
  CODEX_COMMITTED_INDEX,
  CODEX_SVG_INDEX,
];

const abiCoder = ethers.utils.defaultAbiCoder;
const hexlify = ethers.utils.hexlify;

function logProof(name, prepared, proof) {
  // remember, the inputs are indirect, so prepared != inputs
  console.log(`leafHash: ${leafHash(prepared)}`);
  console.log("proof", proof);
  let x = abiCoder.encode(LeafObject.ABI, prepared);
  console.log(`encoded:(${name})) ${hexlify(x)}`);
  console.log("");
}

/**
 *
 * @param {{getIndexedItem:Function}} codex
 * @param {ikeys?:number[]} options
 */
export function codexTrialDetails(codex, options = {}) {
  const map = JSON.parse(codex.getIndexedItem(CODEX_MAP_INDEX, options));
  const staticRootLabel = rootLabel(map);
  const furnishings = JSON.parse(
    codex.getIndexedItem(CODEX_FURNITURE_INDEX, options)
  );

  let svg;
  if (codex.hasIndexedItem(CODEX_SVG_INDEX))
    svg = JSON.parse(codex.getIndexedItem(CODEX_SVG_INDEX, options));

  const topology = LogicalTopology.fromMapJSON(map);
  topology.placeFurniture(new Furniture(furnishings));
  return {
    staticRootLabel,
    map,
    svg,
    topology,
    trie: topology.commit(),
    furnishings,
  };
}

export class Trial {
  /**
   *
   * @param {and} codex
   * @param {ikeys?:number[]} options
   */
  static fromCodex(codex, gid, options = {}) {
    const { staticRootLabel, map, topology, trie, svg } = codexTrialDetails(
      codex,
      options
    );
    return new Trial(gid, staticRootLabel, { map, topology, trie, svg });
  }

  /**
   * @constructor
   * @param {object} map
   */
  constructor(gid, staticRootLabel, dungeon) {
    this.gid = gid;
    this.staticRootLabel = ethers.utils.formatBytes32String(staticRootLabel);
    this.map = dungeon.map;
    this.svg = dungeon.svg;
    this.topology = dungeon.topology;
    this.staticTrie = dungeon.trie;

    this.arena = undefined;
    this.scenes = undefined;
  }

  /**
   * @param {number} location
   * @returns {{data, choices}}
   */
  scene(location) {
    throw new Error("nyi");
  }

  /**
   * @param {[...number]} starts
   * @returns {{choices, data}}
   */
  createStartGameArgs(starts) {
    // one of each for each trialist.

    const startChoices = [];
    const proofs = [];
    const data = [];

    for (let itrialist = 0; itrialist < starts.length; itrialist++) {
      const { choices, proof } = this.locationChoices(starts[itrialist]);
      data.push("0x");
      startChoices.push(choices);
      proofs.push(proof);
    }

    return {
      choices: startChoices,
      data,
      rootLabel: this.staticRootLabel,
      proofs,
    };
  }

  /**
   *
   * @param {number} id  location id
   * @returns {{choices: {typeId, inputs}, proof}}
   */
  locationChoices(id) {
    const [typeId, inputs] = this.topology.locationChoicesPrepared[id];
    const proof = this.topology.locationChoicesProof[id];
    return {
      choices: { typeId, inputs },
      proof,
    };
  }

  createResolveOutcomeArgs(trialist, locationId, choice) {
    const inputs = choice.map((i) => deconditionInput(i));

    switch (inputs[0]) {
      case LocationChoiceType.North:
      case LocationChoiceType.West:
      case LocationChoiceType.South:
      case LocationChoiceType.East:
        if (locationId === this.topology.finishLocationId) {
          const [side, exit] = inputs;
          const exitId = this.topology.exitId(locationId, side, exit);
          if (exitId === this.topology.finishExitId)
            return this.createResolveOutcomeFinishArgs(
              trialist,
              locationId,
              choice
            );
          // else fall through, its a normal navigation exit
        }

        return this.createResolveOutcomeNavigationArgs(
          trialist,
          locationId,
          choice
        );
      case LocationChoiceType.OpenChest:
        return this.createResolveOpenChest(trialist, locationId, inputs);
    }
  }

  createResolveOpenChest(trialist, locationId, inputs) {
    if (inputs[0] !== LocationChoiceType.OpenChest)
      throw new Error(`Trial# invalid input for OpenChest`);
    const location = this.topology.locationChoices[locationId];
    const locationInputIndex = location.leaf.matchInput(inputs);

    const leaves = [];
    const stack = [];

    let prepared = this.topology.locationChoicesPrepared[locationId];
    let proof = this.topology.locationChoicesProof[locationId];

    // STACK (0) current location
    // [LOCATIONCHOICE, [[location], [choice], ... [choice]]] => #L
    leaves.push({ typeId: prepared[0], inputs: prepared[1] });
    stack.push({
      inputRefs: [],
      proofRefs: [],
      rootLabel: this.staticRootLabel,
      proof,
    });
    logProof("STACK(0) LOCATION", prepared, stack[stack.length - 1]);

    // STACK(1) to ChestOpen proof

    // The only chests we have are death traps, thats a bit of a spoiler for
    // now, but treat chests will follow.

    // Obtain an proof linking the furniture to a specific choice menu type choice.
    // [FURNITURE-TYPE, [[CHOICE-TYPE], [REF(#L, i)]]]
    // note that the proof for the current location choice is at STACK(0)
    const id = this.topology.furnitureId(locationId, ...inputs);
    const furn = this.topology.furnLeafs[id];
    if (!Furnishing.isOpenableType(furn.type))
      throw new Error(`furniture type ${furn.type} is not openable`);

    prepared = this.topology.furnPrepared[id];
    if (!Furnishing.isOpenableType(prepared[0]))
      throw new Error(`OpenChest transition type ${prepared[0]} unsuported`);

    proof = this.topology.furnProof[id];
    // the inputs are indirect, the stack slot and the input index
    leaves.push({
      typeId: prepared[0],
      inputs: conditionInputs([prepared[1][0], [0, locationInputIndex]]),
    });
    stack.push({
      inputRefs: [1], // mark the second input as an indirect reference to a prior stack entries proof input
      proofRefs: [],
      rootLabel: this.staticRootLabel,
      proof,
    });
    logProof("STACK(1) FURNITURE-TYPE", prepared, stack[stack.length - 1]);

    return {
      participant: trialist,
      outcome: TranscriptOutcome.Accepted,
      proof: {
        choiceSetType: ObjectType.LocationChoices,
        transitionType: Furnishing.onOpenTransitionType(prepared[0]),
        stack,
        leaves,
      },
      data: "0x",
      choiceLeafIndex: 0, // XXX: this refers to the current choice, this is just temporary till game completion is in place on the contracts
    };
  }

  createResolveOutcomeFinishArgs(trialist, locationId, choice) {
    // const location = this.locationChoices[locationId];
    const location = this.topology.locationChoices[locationId];

    const [side, exit] = choice.map((i) => deconditionInput(i));
    const locationInputIndex = location.leaf.matchInput([side, exit]);

    const leaves = [];
    const stack = [];

    let prepared = this.topology.locationChoicesPrepared[locationId];
    let proof = this.topology.locationChoicesProof[locationId];

    // STACK (0) current location
    // [LOCATIONCHOICE, [[location], [choice], ... [choice]]] => #L
    leaves.push({ typeId: prepared[0], inputs: prepared[1] });
    stack.push({
      inputRefs: [],
      proofRefs: [],
      rootLabel: this.staticRootLabel,
      proof,
    });
    logProof("STACK(0) LOCATION", prepared, stack[stack.length - 1]);

    // STACK(1) to FINISH proof
    // Obtain an exit proof linking the EXIT to a specific location menu choice.
    // [FINISH, [[REF(#L, i)]]]
    // note that the proof for the current location choice is at STACK(0)
    let id = this.topology.exitId(locationId, side, exit);
    prepared = this.topology.exitsPrepared[id];
    if (prepared[0] !== ObjectType.Finish)
      throw new Error(`chosen exit ${exit} on side ${side} is not the finish`);

    proof = this.topology.exitsProof[id];
    // the inputs are indirect, the stack slot and the input index
    leaves.push({
      typeId: prepared[0],
      inputs: conditionInputs([[0, locationInputIndex]]),
    });
    stack.push({
      inputRefs: [0], // mark the first input as an indirect reference to a prior stack entries proof input
      proofRefs: [],
      rootLabel: this.staticRootLabel,
      proof,
    });
    logProof("STACK(1) FINISH", prepared, stack[stack.length - 1]);
    return {
      participant: trialist,
      outcome: TranscriptOutcome.Accepted,
      proof: {
        choiceSetType: ObjectType.LocationChoices,
        transitionType: ObjectType.Finish,
        stack,
        leaves,
      },
      data: "0x",
      choiceLeafIndex: 0, // XXX: this refers to the current choice, this is just temporary till game completion is in place on the contracts
    };
  }

  /**
   *
   * @param {ethers.AddressLike} trialist
   * @param {ethers.DataHexString[]} choice
   * @returns
   */
  createResolveOutcomeNavigationArgs(trialist, locationId, choice) {
    // const location = this.locationChoices[locationId];
    const location = this.topology.locationChoices[locationId];

    const [side, exit] = choice.map((i) => deconditionInput(i));
    const locationInputIndex = location.leaf.matchInput([side, exit]);

    const leaves = [];
    const stack = [];

    let prepared = this.topology.locationChoicesPrepared[locationId];
    let proof = this.topology.locationChoicesProof[locationId];

    // STACK (0) current location
    // [LOCATIONCHOICE, [[location], [choice], ... [choice]]] => #L
    leaves.push({ typeId: prepared[0], inputs: prepared[1] });
    stack.push({
      inputRefs: [],
      proofRefs: [],
      rootLabel: this.staticRootLabel,
      proof,
    });
    logProof("STACK(0) LOCATION", prepared, stack[stack.length - 1]);

    // STACK(1) to EXIT proof
    // Obtain an exit proof linking the EXIT to a specific location menu choice.
    // [EXIT, [[REF(#L, i)]]]
    // note that the proof for the current location choice is at STACK(0)
    let id = this.topology.exitId(locationId, side, exit);
    prepared = this.topology.exitsPrepared[id];
    proof = this.topology.exitsProof[id];
    // the inputs are indirect, the stack slot and the input index
    leaves.push({
      typeId: prepared[0],
      inputs: conditionInputs([[0, locationInputIndex]]),
    });
    stack.push({
      inputRefs: [0], // mark the first input as an indirect reference to a prior stack entries proof input
      proofRefs: [],
      rootLabel: this.staticRootLabel,
      proof,
    });
    logProof("STACK(1) EXIT", prepared, stack[stack.length - 1]);

    const [ingressLocationId, ingressSide, ingressExit] =
      this.topology._accessJoin(locationId, side, exit);
    prepared = this.topology.locationChoicesPrepared[ingressLocationId];
    proof = this.topology.locationChoicesProof[ingressLocationId];

    // Set STACK(2) to the ingress location
    leaves.push({
      typeId: prepared[0],
      inputs: prepared[1],
    });
    stack.push({
      inputRefs: [],
      proofRefs: [],
      rootLabel: this.staticRootLabel,
      proof,
    });
    logProof("STACK(2) INGRESS LOCATION", prepared, stack[stack.length - 1]);

    // Set STACK(3) to ingress location exit
    // Obtain an exit proof linking the EXIT to a specific location menu choice.
    // [EXIT, [[REF(#L, i)]]]
    // note that the proof for the ingress location choice is at STACK(2)
    const ingressLocation = this.topology.locationChoices[ingressLocationId];
    const ingressLocationInputIndex = ingressLocation.leaf.matchInput([
      ingressSide,
      ingressExit,
    ]);
    id = this.topology.exitId(ingressLocationId, ingressSide, ingressExit);
    prepared = this.topology.exitsPrepared[id];
    proof = this.topology.exitsProof[id];

    leaves.push({
      typeId: prepared[0],
      inputs: conditionInputs([[2, ingressLocationInputIndex]]),
    });
    stack.push({
      inputRefs: [0], // mark the first input as an indirect reference to a prior stack entries proof input
      proofRefs: [],
      rootLabel: this.staticRootLabel,
      proof,
    });
    logProof("STACK(3) INGRESS EXIT", prepared, stack[stack.length - 1]);

    // Now add the link. Note that links are directional. For each location exit
    // pair there is a link from a -> b and also b->a. So the link used here
    // must be FROM the *current* location. The 'finish' will likely be a one
    // way link.

    // Set STACK(4) to link  exit (stack 1), exit (stack 3)
    // [LINK, [[REF(#E-S1)], [REF(#E-S3)]]]

    id = this.topology.locationLinkId(locationId, side, exit); // from current location
    prepared = this.topology.locationExitLinksPrepared[id];
    proof = this.topology.locationExitLinksProof[id];
    leaves.push({
      typeId: prepared[0],
      inputs: conditionInputs([
        [1], // STACK(1)
        [3], // STACK(3)
      ]),
    });
    stack.push({
      inputRefs: [],
      proofRefs: [0, 1],
      rootLabel: this.staticRootLabel,
      proof,
    });
    logProof("STACK(4) LINK", prepared, stack[stack.length - 1]);

    return {
      participant: trialist,
      outcome: TranscriptOutcome.Accepted, // Accepted
      proof: {
        choiceSetType: ObjectType.LocationChoices,
        transitionType: ObjectType.Link2,
        stack,
        leaves,
      },
      data: "0x",
      choiceLeafIndex: 2, // the new choice set if the proof is accepted
    };
  }
}
