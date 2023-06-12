/**
 * Encodes the exits available to the location scene exit menu. These form the
 * basis of the location links.
 */

import { ObjectType } from "./objecttypes.js";
import { LogicalRef, LogicalRefType } from "./logicalref.js";

/**
 * [EXIT, [[REF(#S, i)], [REF(#L)]]]
 */
export class LocationExit {
  static ObjectType = ObjectType.Exit;

  constructor(sceneInputRef, locationRef) {
    this.sceneInputRef = sceneInputRef;
    this.locationRef = locationRef;
  }

  inputs(options) {
    const resolveValue = options?.resolveValue;
    if (!resolveValue)
      throw new Error(`a reference resolver is required to prepare LocationExit instances`);

    const sceneInputRefValue = resolveValue(this.sceneInputRef);
    const locationRefValue = resolveValue(this.locationRef);
    return [[sceneInputRefValue], [locationRefValue]];
  }

  /**
   * @param {{resolveValue(ref:LogicalRef):string|number}} options 
   * @returns 
   */
  prepare(options) {
    return [LocationExit.ObjectType, this.inputs(options)];
  }

  static hydrate(prepared, options) {

    throw new Error(`needs more thought`);
    if (prepared[0] !== LocationExit.ObjectType)
      throw new Error(`bad type ${prepared[0]} for LocationExit`);

    const recoverTarget = options?.recoverTarget;
    if (!recoverTarget) throw new Error(`a reference recovery call back is required`);
    const {exitId, exitMenu} = recoverTarget(ObjectType.ExitMenu, prepared[1][0][0]);
    const sceneInputRef = new LogicalRef(LogicalRefType.ProofInput, ObjectType.ExitMenu, exitId, undefined);

    const {location2Id, locationMenu} = recoverTarget(LogicalRefType.Proof, ObjectType.Location2, prepared[1][0][1]);
    const locationRef = new LogicalRef(LogicalRefType.Proof, ObjectType.Location2, location2Id);

    return new LocationExit(sceneInputRef, locationRef);
  }

}