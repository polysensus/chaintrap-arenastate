import { ethers } from "ethers";
import { undefinedIfZeroBytesLike } from "./ethutil.js";

import { PropDelta } from "./propdelta.js";

/**
 * @template {{
 *  registered:boolean,
 *  address:string,
 *  profile:object,
 *  node:ethers.BytesLike,
 *  scene:object,
 *  data:ethers.BytesLike,
 *  rootLabel:ethers.BytesLike,
 *  lastEID:ethers.BigNumber
 * }} PlayerStateLike
 */
export class PlayerState {
  static propDelta = new PropDelta(
    [
      "registered",
      "address",
      "profile",
      "rootLabel",
      "node",
      "scene",
      "data",
      "lastEID",
    ],
    {
      profile: (profile) => undefinedIfZeroBytesLike(profile),
      node: (node) => undefinedIfZeroBytesLike(node),
      data: (data) => undefinedIfZeroBytesLike(data),
    }
  );

  static conditionValue(name, value) {
    return PlayerState.propDelta.conditionValue(name, value);
  }

  /**
   * See {@link PropDelta.delta}
   * @param {PlayerStateLike} source
   * @param {PlayerStateLike} other
   */
  static delta(source, other) {
    return PlayerState.propDelta.delta(source, other);
  }

  /**
   * See {@link PropDelta.update}
   * @param {PlayerStateLike} target
   * @param {PlayerStateLike} update
   * @returns
   */
  static update(target, update) {
    return PlayerState.propDelta(target, update);
  }
}
