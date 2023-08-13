import { conditionInput, conditionInputs } from "./objects.js";

import { ObjectType } from "./objecttypes.js";
import { LogicalRef } from "./logicalref.js";

/**
 * TODO:
 * update ObjectType and encode/prepare etc for new ObjectType
 * update LogicalTopology reference stuff for new ObjectType
 *
 */

export class LocationChoices {
  static ObjectType = ObjectType.LocationChoices;
  static LOCATION_INPUT = 0;
  static CHOICE_INPUTS = 1;

  /**
   *
   * @param {number} location
   * @param {[[]]} sideExits
   * @param {[[]]} furniture
   */
  constructor(location, sideExits, furniture) {
    this.location = location;
    this.sideExits = sideExits;
    this.furniture = furniture;
  }

  /**
   * return the input index where the choices start, or return inputs.length if there are none.
   * @returns {number}
   */
  iChoices() {
    return LocationChoices.CHOICE_INPUTS;
  }

  /**
   * @param {number[]} choice
   * @returns {number} matching input index or undefined
   */
  matchInput(choice) {
    const inputs = this.inputs({ unconditioned: true });
    for (let i = this.iChoices(); i < inputs.length; i++) {
      if (choice.length !== inputs[i].length) continue;

      let matched = 0;
      for (let j = 0; j < choice.length; j++)
        if (choice[j] === inputs[i][j]) matched += 1;
      if (matched === choice.length) return i;
    }
  }

  inputs(options) {
    if (!options.unconditioned) {
      let conditioned = [
        [conditionInput(this.location)],
        ...conditionInputs(this.sideExits)
      ]
      if (this.furniture?.length > 0)
        conditioned = [...conditioned, ...conditionInputs(this.furniture)];
      return conditioned;
    }
    let unconditioned = [[this.location], ...this.sideExits];
    if (this.furniture?.length > 0)
      unconditioned = [...unconditioned, ...this.furniture];
    return unconditioned;
  }

  /**
   * @param {{resolveValue(ref:LogicalRef):string|number}} options
   * @returns
   */
  prepare(options) {
    return [LocationChoices.ObjectType, this.inputs(options)];
  }
}
