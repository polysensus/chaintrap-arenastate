import { ethers } from "ethers";
/**
 * Defines an ingress or egress as a tripple of location, side and access index
 */
export class Access {
  static ABI = ["uint16 location", "uint16 side", "uint16 access"];
  /**
   * @template {location: number, side: number, access: number} AccessLike
   * @param {AccessLike} access
   */
  constructor(access) {
    this.location = access.location;
    this.side = access.side;
    this.access = access.access;
  }

  /**
   *
   * @param {*} coder if not provided, ethers.utils.defaultAbiCoder is used.
   * @returns abi encoded access definition
   */
  encode() {
    return ethers.utils.defaultAbiCoder.encode(Access.ABI, [
      this.location,
      this.side,
      this.access,
    ]);
  }

  static decode(data) {
    return new Access(ethers.utils.defaultAbiCoder.decode(Access.ABI, data));
  }
}
