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
   * @param {number} index
   */
  constructor(type, targetType, index) {
    /**
     * The type of the reference.
     */
    this.type = type;
    this.targetType = targetType;
    this.index = index;
  }
}
