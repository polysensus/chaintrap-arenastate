import { ethers } from "ethers";

import { Access } from "./access.js";
/**
 * Defines a pair of linked accesses
 */
export class Link {
  static ABI = [
    "tuple(uint16 location, uint16 side, uint16 access) a",
    "tuple(uint16 location, uint16 side, uint16 access) b",
  ];

  constructor() {
    /** @readonly */
    this.a;
    /** @readonly */
    this.b;
  }

  /**
   * @template {location: number, side: number, access: number} AccessLike
   * @param { AccessLike } a
   * @param { AccessLike } b
   */
  set(a, b) {
    this.a = new Access(a);
    this.b = new Access(b);
    return this; // allow chaining
  }

  /**
   * @template {a: {location: number, side: number, access: number}, b: {location: number, side: number, access: number}}  LinkLike
   * @param { LinkLike } link
   */
  setLink(link) {
    return this.set(link.a, link.b);
  }

  /**
   * @template {[[number, number, number], [number, number, number]]} ArrayLinksLike
   * @param { ArrayLinksLike } link
   */
  setArrayLink(link) {
    return this.set(
      { location: link[0][0], side: link[0][1], access: link[0][2] },
      { location: link[1][0], side: link[1][1], access: link[1][2] }
    );
  }

  asArrayLink() {
    return [
      [this.a.location, this.a.side, this.a.access][
        (this.b.location, this.b.side, this.b.access)
      ],
    ];
  }

  /**
   *
   * @param {*} coder if not provided, ethers.utils.defaultAbiCoder is used.
   * @returns abi encoded access definition
   */
  encode() {
    return ethers.utils.defaultAbiCoder.encode(Link.ABI, [this.a, this.b]);
  }

  static decode(data) {
    return new Link().setLink(
      ethers.utils.defaultAbiCoder.decode(Link.ABI, data)
    );
  }
}
