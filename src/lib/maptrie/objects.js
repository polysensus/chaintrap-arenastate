import { ethers } from "ethers";
import * as msgpack from "@msgpack/msgpack";

import { Access } from "./access.js";
import { Link } from "./link.js";

export class ObjectType {
  static Invalid = 0;
  static Access = 1;
  static Link = 2;
}

/**
 * All merkle leaves take this form. The type code ensures the leaf object
 * encodings are unique for all types. This means we can put any leaf object in
 * any trie without fear of ambiguity.
 */
export class LeafObject {
  static ABI = ["uint16 type", "bytes leaf"];

  /**
   * @template {type: {ObjectType.Access}, leaf: {Access|object}} LeafObjectLike
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
   * @template {{a: AccessLike, b: AccessLike}} LinkLike
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
    [ObjectType.Link, (link) => link],
  ]);
  static typeHydrate = Object.fromEntries([
    [ObjectType.Access, (prepared) => new Access(prepared)],
    [ObjectType.Link, (prepared) => new Link(prepared.a, prepared.b)],
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
  static prepare(o) {
    const preper = ObjectCodec.typePrepare[o.type];
    if (!preper) throw new Error(`type ${o.type} not configured`);

    const encoded = msgpack.encode(preper(o.leaf));
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
