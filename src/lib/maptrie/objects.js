import { ethers } from "ethers";
const arrayify = ethers.utils.arrayify;
const keccak256 = ethers.utils.keccak256;

import * as msgpack from "@msgpack/msgpack";

import { Access } from "./access.js";
import { Link } from "./link.js";
import { ExitMenu } from "./sceneexitchoice.js";
import { ObjectType } from "./objecttypes.js";
import { LocationMenu } from "./locationscene.js";

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
 * All merkle leaves take this form. The type code ensures the leaf object
 * encodings are unique for all types. This means we can put any leaf object in
 * any trie without fear of ambiguity.
 *
 *
 */
export class LeafObject {
  static ABI = ["uint16 type", "bytes leaf"];

  /**
   * @constructor
   * @template {{type: ObjectType.Access, leaf: Access|object}} LeafObjectLike
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
   * Create a new LeafObject instance from a previously prepared one
   * @param {[number, ethers.utils.BytesLike]} prepared
   * @returns {LeafObject}
   */
  static hydrate(prepared) {
    return ObjectCodec.hydrate(prepared);
  }

  /**
   * @template {{location: number, side: number, exit: number}} AccessLike
   * @template {{a:AccessLike, b:AccessLike}} LinkLike
   * @param {LinkLike} link
   */
  static linkLeaf(link) {
    return new LeafObject({ type: ObjectType.Link, leaf: link });
  }

  /**
   * @template {{location: number, side: number, exit: number}} AccessLike
   * @param {AccessLike} access
   */
  static accessLeaf(access) {
    return new LeafObject({ type: ObjectType.Access, leaf: access });
  }
}

export class ObjectCodec {
  static typePrepare = Object.fromEntries([
    [ObjectType.Access, (leaf) => leaf],
    [ObjectType.Link, (leaf) => leaf],
    [ObjectType.ExitMenu, (leaf) => leaf.prepare()],
    [ObjectType.LocationSceneRef, (leaf, options) => leaf.prepare(options)],
  ]);
  static typeHydrate = Object.fromEntries([
    [ObjectType.Access, (prepared) => new Access(prepared)],
    [ObjectType.Link, (prepared) => new Link(prepared.a, prepared.b)],
    [ObjectType.ExitMenu, (prepared) => ExitMenu.hydrate(prepared)],
    [ObjectType.LocationSceneRef, (prepared, options) => LocationMenu.hydrate(prepared, options)],
  ]);

  /**
   * Prepare a LeafObject to be ethers ABI encoded according to {@link LeafObject.ABI}
   * The round trip looks like this:
   *  const encoded = ethers.utils.defaultAbiCoder.encode(LeafObject.ABI, ObjectCodec.prepare(leafObject))
   *  const decoded = ethers.utils.defaultAbiCoder.decode(LeafObject.ABI, encoded)
   *
   * @param {LeafObject} o
   * @template {[number, ethers.utils.BytesLike]} PreparedLeafLike
   * @return {PreparedLeafLike}
   */
  static prepare(o, options) {
    const preper = ObjectCodec.typePrepare[o.type];
    if (!preper) throw new Error(`type ${o.type} not configured`);

    const encoded = msgpack.encode(preper(o.leaf, options));
    return [o.type, ethers.utils.hexlify(encoded)];
  }

  /**
   * Decode and hydrate the wrapped leaf, given the results of abi decoding the
   * ethers abi encoded leaf using {@link LeafObject.ABI}
   * The round trip looks like this:
   *  const encoded = ethers.utils.defaultAbiCoder.encode(LeafObject.ABI, ObjectCodec.prepare(leafObject))
   *  const decoded = ethers.utils.defaultAbiCoder.decode(LeafObject.ABI, encoded)
   * @param {ethers.utils.BytesLike} data
   * @returns {LeafObject}
   */
  static hydrate(prepared) {
    const encoded = ethers.utils.arrayify(prepared.leaf);
    const decoded = msgpack.decode(encoded);
    const hydrator = ObjectCodec.typeHydrate[prepared.type];
    if (!hydrator) throw new Error(`type ${prepared.type} not configured`);

    return new LeafObject({
      type: prepared.type,
      leaf: hydrator(decoded),
    });
  }
}
