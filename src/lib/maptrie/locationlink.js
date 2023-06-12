/**
 * Encodes the association of a location with its exit menu choices (scene)
 */

import { ObjectType } from "./objecttypes.js";
import { LogicalRefType } from "./logicalref.js";

/**
 * Prepares [LOCATION, [[location], [#S]]]
 * #S is the scene menu key
 */
export class LocationLink {
  static ObjectType = ObjectType.Location2;
  /**
   * 
   * @param {number|string} location location number or token
   * @param {*} sceneMenuKey trie key for the scene menu choice data associated with this location.
   */
  constructor(exitRefA, exitRefB) {
    this.exitRefA = exitRefA;
    this.exitRefB = exitRefB;
  }

  inputs(options) {
    const resolveValue = options?.resolveValue;
    if (!resolveValue)
      throw new Error(`a reference resolver is required to prepare LocationLink instances`);

    const a = resolveValue(this.exitRefA);
    const b = resolveValue(this.exitRefB);
    return [[a], [b]];
  }

  /**
   * @param {{resolveValue(ref:LogicalRef):string|number}} options 
   * @returns 
   */
  prepare(options) {
    return [LocationLink.ObjectType, this.inputs(options)];
  }

  static hydrate(prepared, options) {
    if (prepared[0] !== LocationLink.ObjectType)
      throw new Error(`bad type ${prepared[0]} for LocationLink`);

    const recoverTarget = options?.recoverTarget;
    if (!recoverTarget) throw new Error(`a reference recovery call back is required`);
    const a = recoverTarget(prepared[1][0][0]);
    const b = recoverTarget(prepared[1][1][0]);
    return new LocationLink(a, b);
  }
}