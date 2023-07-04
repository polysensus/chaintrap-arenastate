import { ObjectType } from "./objecttypes.js";
import { LocationExit } from "./locationexit.js";

/**
 * [FINISH, [[REF(#L, i)]]]
 */
export class FinishExit extends LocationExit {
  static ObjectType = ObjectType.Finish;
  // TODO: be sure that locationExitRefs are made to work for this case in LogicalTopology
  prepare(options) {
    return [FinishExit.ObjectType, this.inputs(options)];
  }
}
