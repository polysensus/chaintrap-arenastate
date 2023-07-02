/**
 * Encodes the exits available to the location scene exit menu. These form the
 * basis of the location links.
 */

import { conditionInput } from "./objects.js";

import { ObjectType } from "./objecttypes.js";
import { LogicalRef } from "./logicalref.js";

/**
 * [EXIT, [[REF(#L, i)]]]
 */
export class LocationExit {
  static ObjectType = ObjectType.Exit;

  constructor(locationExitRef) {
    this.locationExitRef = locationExitRef;
  }

  inputs(options) {
    const resolveValue = options?.resolveValue;
    if (!resolveValue)
      throw new Error(
        `a reference resolver is required to prepare LocationExit instances`
      );

    const locationExit = resolveValue(this.locationExitRef);
    if (!options.unconditioned)
      return [locationExit.map((i) => conditionInput(i))];
    return [locationExit];
  }

  /**
   * @param {{resolveValue(ref:LogicalRef):string|number}} options
   * @returns
   */
  prepare(options) {
    return [LocationExit.ObjectType, this.inputs(options)];
  }
}
