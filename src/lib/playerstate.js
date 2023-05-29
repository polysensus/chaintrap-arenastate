import { ethers } from "ethers";

/**
 * @template {{
 *  registered:boolean,
 *  address:string,
 *  profile:object,
 *  location,
 *  locationIngress,
 *  startLocation,
 *  sceneblob,
 *  halted:boolean,
 *  rootLabel:string,
 *  pendingOutcomeType:number,
 *  lastEID
 * }} PlayerStateLike
 */
export class PlayerState {
  static Variables = [
    "registered",
    "address",
    "profile",
    "location",
    "locationIngress",
    "startLocation",
    "sceneblob",
    "halted",
    "pendingOutcomeType",
    "lastEID",
  ];

  static VariableConditioning = {
    profile: (profile) => conditionBytesLikeAllZerosIsUndefined(profile),
    startLocation: (startLocation) =>
      conditionBytesLikeAllZerosIsUndefined(startLocation),
  };

  // constructor () { }

  toObject() {
    const o = {};
    for (const variable of PlayerState.Variables) {
      if (typeof this[variable] !== "undefined") o[variable] = this[variable];
    }
    return o;
  }

  clone() {
    const c = new PlayerState();
    for (const variable of PlayerState.Variables) {
      c[variable] = this[variable];
    }
    return c;
  }

  /**
   * @param {PlayerStateLike} other
   */
  diff(other) {
    const delta = {};

    for (const variable of PlayerState.Variables) {
      if (typeof this[variable] !== other[variable])
        delta[variable] = other[variable];
    }
  }

  /**
   *
   * @param {PlayerStateLike} param0
   * @returns
   */
  update(update) {
    for (const variable of PlayerState.Variables) {
      const conditioning =
        PlayerState.VariableConditioning[variable] ?? ((value) => value);
      const value = conditioning(update[variable]);
      if (typeof value !== "undefined") this[variable] = value;
    }
    return this;
  }
}

function conditionBytesLikeAllZerosIsUndefined(maybeBytes) {
  if (ethers.utils.isBytesLike(maybeBytes)) {
    if (ethers.utils.stripZeros(maybeBytes).length === 0) return undefined;
    return maybeBytes;
  }
  return maybeBytes;
}
