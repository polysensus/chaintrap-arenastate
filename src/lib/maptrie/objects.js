import { ethers } from "ethers";
const arrayify = ethers.utils.arrayify;
const keccak256 = ethers.utils.keccak256;
const zeroPad = ethers.utils.zeroPad;
const hexlify = ethers.utils.hexlify;
const abiCoder = ethers.utils.defaultAbiCoder;

import * as msgpack from "@msgpack/msgpack";

import { Access } from "./access.js";
import { Link } from "./link.js";
import { LocationChoices } from "./locationchoices.js";
import { LocationLink } from "./locationlink.js";
import { ObjectType } from "./objecttypes.js";

/**
 * Convert an input value to an ethers compatible representation of a solidity
 * bytes32
 * @param {number|string} value
 */
export function conditionInput(value) {
  return hexlify(zeroPad(hexlify(value), 32));
}

/**
 * apply conditionInput to all inputs
 * @param {*} inputs
 * @returns
 */
export function conditionInputs(inputs) {
  const inputs32 = [];
  for (let input of inputs) inputs32.push(input.map((i) => conditionInput(i)));
  return inputs32;
}

export function deconditionInput(value) {
  if (typeof value === "string") return parseInt(value, 16);
  if (value?.constructor?.name === "Uint8Array")
    return ethers.BigNumber.from(value).toNumber();
  // if (typeof value === )
  return value;
}

/**
 * Compute the merkle node value for the prepared {@link LeafObject}
 * standardLeafHash from https://github.com/OpenZeppelin/merkle-tree/blob/master/src/standard.ts#L9
 * @param {[number, ethers.utils.BytesLike]} prepared
 */
export function leafHash(prepared) {
  return keccak256(
    keccak256(
      arrayify(ethers.utils.defaultAbiCoder.encode(LeafObject.ABI, prepared))
    )
  );
}

/**
 * Replicates the contracts side handling for the ProofLeaf
 * input pre-image accumulation. libproofstack.sol directPreimage
 * Note: resolve any LogicalRef's to their target values prior to calling this
 * @param {[][number|string]} inputs
 */
export function directPreimage(inputs) {
  return inputs;
  /*
  const leafPreimage = [];
  for (const input of inputs) {
    let value;
    if (input.length === 2) {
      value = abiCoder.encode(["bytes32", "bytes32"], input);
      value = keccak256(value);
    } else {
      value = input[0];
    }
    leafPreimage.push(value);
  }

  return ethers.utils.concat(leafPreimage);
  */
}

/**
 * All merkle leaves take this form. The type code ensures the leaf object
 * encodings are unique for all types. This means we can put any leaf object in
 * any trie without fear of ambiguity.
 *
 *
 */
export class LeafObject {
  // static ABI = ["uint16 type", "bytes leaf"];
  static ABI = ["uint256 typeId", "bytes32[][] inputs"];
  // static ABI = ["uint256 typeId", "bytes inputs"];

  /**
   * @constructor
   * @template {{type: number, leaf: any}} LeafObjectLike
   * @param {LeafObjectLike} object
   */
  constructor(o) {
    this.type = o.type;
    this.leaf = o.leaf;
  }

  /**
   * Prepare the leaf object for encoding as a trie node
   * @returns {[number, ethers.utils.BytesLike]}
   */
  prepare() {
    return ObjectCodec.prepare(this);
  }

  /**
   * @template {{location: number, side: number, exit: number}} AccessLike
   * @template {{a:AccessLike, b:AccessLike}} LinkLike
   * @param {LinkLike} link
   */
  static linkLeaf(link) {
    return new LeafObject({ type: ObjectType.Link2, leaf: link });
  }
}

export class ObjectCodec {
  static typePrepare = Object.fromEntries([
    [ObjectType.Exit, (leaf, options) => leaf.prepare(options)],
    [ObjectType.LocationChoices, (leaf, options) => leaf.prepare(options)],
    [ObjectType.Link2, (leaf, options) => leaf.prepare(options)],
  ]);

  /**
   * Prepare a LeafObject to be ethers ABI encoded according to {@link LeafObject.ABI}
   * The round trip looks like this:
   *  const encoded = ethers.utils.defaultAbiCoder.encode(LeafObject.ABI, ObjectCodec.prepare(leafObject))
   *  const decoded = ethers.utils.defaultAbiCoder.decode(LeafObject.ABI, encoded)
   *
   * @param {LeafObject} o
   */
  static prepare(o, options) {
    const preper = ObjectCodec.typePrepare[o.type];
    if (!preper) throw new Error(`type ${o.type} not configured`);

    const [typeId, inputs] = preper(o.leaf, options);

    return [typeId, directPreimage(inputs)];
  }
}
