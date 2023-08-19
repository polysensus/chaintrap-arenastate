/**
 * Encodes the chests available to the location menu. These form the
 * basis of the location chest based traps and treats
 */

import { conditionInputs } from "./objects.js";

import { LogicalRef } from "./logicalref.js";

/**
 * [FURNITURE-TYPE, [[CHOICE-TYPE], [REF(#L, i)]]]
 */
export class LocationFurnishing {
  // static ObjectType = ObjectType.Chest;

  /**
   * @param {import('../logicalref.js').LogicalRef} inputRef
   */
  constructor(furn, inputRef) {
    this.furn = furn;
    this.inputRef = inputRef;
  }

  inputs(options) {
    const resolveValue = options?.resolveValue;
    if (!resolveValue)
      throw new Error(
        `a reference resolver is required to prepare LocationExit instances`
      );

    const inputs = [[this.furn.choiceType], resolveValue(this.inputRef)];
    if (!options.unconditioned) return conditionInputs(inputs);
    return inputs;
  }

  /**
   * @param {{resolveValue(ref:LogicalRef):string|number}} options
   * @returns
   */
  prepare(options) {
    return [this.furn.type, this.inputs(options)];
  }
}
