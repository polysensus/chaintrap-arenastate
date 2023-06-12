/**
 * facilitates merkle nodes which encode references between nodes
 */

export class LogicalRefType {
  static Proof = 1;
  static ProofInput = 2;
}

export class LogicalRef {
  /**
   * @constructor
   * @param {LogicalRefType} type
   * @param {ObjectType} targetType
   * @param {number} id identifies the targeted object, typically just an array index.
   * @param {number|undefined} index identifies the input contribution to the targeted object.
   */
  constructor(type, targetType, id, index=undefined) {
    /**
     * The type of the reference.
     */
    this.type = type;
    this.targetType = targetType;
    // target item id, used for both Proof & ProofInput references
    this.id = id;
    // only used for ProofInput type
    this.index = index;
  }
}
