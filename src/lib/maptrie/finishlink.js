import { conditionInput } from "./objects.js";
import { ObjectType } from "./objecttypes.js";

/**
 * Encodes the connection between a location and the finish.
 * Prepares [FINISH_LINK, [[REF(#F)]]]
 */
export class FinishLink {
  static ObjectType = ObjectType.FinishLink;
  constructor(finishRef) {
    this.finishRef = finishRef;
  }

  inputs(options) {
    const resolveValue = options?.resolveValue;
    if (!resolveValue)
      throw new Error(
        `a reference resolver is required to prepare LocationLink instances`
      );

    let value = resolveValue(this.finishRef);
    if (!options?.unconditioned) value = conditionInput(value);
    return [[value]];
  }

  /**
   * @param {{resolveValue(ref:LogicalRef):string|number}} options
   * @returns
   */
  prepare(options) {
    return [FinishLink.ObjectType, this.inputs(options)];
  }
}
