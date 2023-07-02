/**
 * A proof leaf has a type and a collection of inputs. Inputs are always a
 * 2-dimensional array. This form allows proving the existence of relations
 * between items in a merkle trie. Those relations are geared towards menu
 * driven 'choice' games.
 *
 * There are two basic formats, both of which are two dimensional.
 *
 * The regular value format:
 *
 * [[value], [value], [value]]
 *
 * The choice menu format
 *
 * [[path, value], [path, value], [path, value]]
 *
 * path and value are 32byte words always.
 *
 * Note that value is always the last element of the interior dimension in
 * either form.
 *
 * In both cases, the contract proof system permits value to be
 *  a) a direct value
 *  b) a reference to the proven node of another proof
 *  b) a reference to the *input* field of another proof
 *
 * To support references, the contracts support submitting a 'stack' of proofs.
 * The references are resolved in the context of that stack.
 *
 * For the choice menu format 'path' is expected to be a linearized depth first
 * encoding of a hierarchical menu. the allocation of bits/bytes to that
 * representation is application specific but is most easily dealt with if it is
 * just (32 / max depth). So
 */
export class ProofInputs {
  /**
   * @constructor
   * @param {[[]]} inputs
   */
  constructor(inputs) {
    this.inputs = structuredClone(inputs);
  }
}
