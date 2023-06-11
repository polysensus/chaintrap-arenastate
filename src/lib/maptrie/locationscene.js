/**
 * Encodes the association of a location with its exit menu choices (scene)
 */

import { ObjectType } from "./objecttypes.js";
import { LogicalRefType } from "./logicalref.js";

/**
 * Prepares [LOCATION, [[location], [#S]]]
 * #S is the scene menu key
 */
export class LocationMenu {
  static ObjectType = ObjectType.LocationSceneRef;
  /**
   * 
   * @param {number|string} location location number or token
   * @param {*} sceneMenuKey trie key for the scene menu choice data associated with this location.
   */
  constructor(location, sceneMenuRef) {
    this.location = location;
    this.sceneMenuRef = sceneMenuRef;
  }

  /**
   * @param {{resolveValue(ref:LocationRef):string|number}} options 
   * @returns 
   */
  prepare(options) {
    const resolveValue = options?.resolveValue;
    if (!resolveValue)
      throw new Error(`a reference resolver is required to prepare LocationMenu instances`);
    const sceneKey = resolveValue(this.sceneMenuRef);
    return [LocationMenu.ObjectType, [[this.location], [sceneKey]]];
  }

  static hydrate(prepared, options) {
    if (prepared[0] !== LocationMenu.ObjectType)
      throw new Error(`bad type ${prepared[0]} for LocationMenu`);

    const recoverRef = options?.recoverReference;
    if (!recoverRef) throw new Error(`a reference recovery call back is required`);
    const location = prepared[1][0][0];
    const sceneMenuRef = recoverRef(
      LogicalRefType.Proof, ObjectType.ExitMenu, prepared[1][1][0]);
    return new LocationMenu(location, sceneMenuRef);
  }
}