/**
 * Encodes the association of a location with its exit menu choices (scene)
 */

import { conditionInput } from "./objects.js";
import { ObjectType } from "./objecttypes.js";

/**
 * Prepares [LINK, [[REF(#Ea)], [REF(#Eb)]]]
 */
export class LocationLink {
  static ObjectType = ObjectType.Link2;
  constructor(exitRefA, exitRefB) {
    this.exitRefA = exitRefA;
    this.exitRefB = exitRefB;
  }

  inputs(options) {
    const resolveValue = options?.resolveValue;
    if (!resolveValue)
      throw new Error(
        `a reference resolver is required to prepare LocationLink instances`
      );

    let a = resolveValue(this.exitRefA);
    let b = resolveValue(this.exitRefB);
    if (!options?.unconditioned) {
      a = conditionInput(a);
      b = conditionInput(b);
    }
    return [[a], [b]];
  }

  /**
   * @param {{resolveValue(ref:LogicalRef):string|number}} options
   * @returns
   */
  prepare(options) {
    return [LocationLink.ObjectType, this.inputs(options)];
  }
}
