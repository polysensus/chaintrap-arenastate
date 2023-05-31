import { ethers } from "ethers";
import { undefinedIfZeroBytesLike } from "./chainkit/ethutil.js";

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
 * }} TrialistStateLike
 */
export class TrialistState {
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
    return TrialistState.propDelta.conditionValue(name, value);
  }

  /**
   * See {@link PropDelta.delta}
   * @param {TrialistStateLike} source
   * @param {TrialistStateLike} other
   */
  static delta(source, other) {
    return TrialistState.propDelta.delta(source, other);
  }

  /**
   * See {@link PropDelta.update}
   * @param {TrialistStateLike} target
   * @param {TrialistStateLike} update
   * @returns
   */
  static update(target, update) {
    return TrialistState.propDelta(target, update);
  }
}
