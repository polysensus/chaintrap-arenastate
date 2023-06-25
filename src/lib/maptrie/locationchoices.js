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

  constructor(location, sideExits) {
    this.location = location;
    this.sideExits = sideExits;
  }

  /**
   * return the input index where the choices start, or return inputs.length if there are none.
   * @returns {number}
   */
  iChoices() {return 1}

  /**
   * @param {number[]} choice
   * @returns {number} matching input index or undefined
   */
  matchInput(choice) {

    const inputs = this.inputs({ unconditioned: true });
    for (let i = this.iChoices(); i < inputs.length; i++) {
      if (choice.length !== inputs[i].length)
        continue

      let matched = 0;
      for (let j = 0; j < choice.length; j++)
        if (choice[j] === inputs[i][j])
          matched += 1;
      if (matched === choice.length)
        return i;
    }
  }


  inputs(options) {

    if (!options.unconditioned)
      return [[conditionInput(this.location)], ...conditionInputs(this.sideExits)];
    
    return [[this.location], ...this.sideExits];
  }

  /**
   * @param {{resolveValue(ref:LogicalRef):string|number}} options
   * @returns
   */
  prepare(options) {
    return [LocationChoices.ObjectType, this.inputs(options)];
  }
}
