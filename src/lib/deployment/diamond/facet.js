import { signatureSelector } from "../abiutil.js";

/**
 * Accumulate a set of {@link FacetCutOpts} on an 'as is' basis.
 */
export class FacetSelectorSet {
  constructor() {
    this.reset();
  }
  reset() {
    this.cutterOpts = [];
  }

  /** Add a list of facets. Each entry may optionaly be an object representation
   * of or an instance of {@link FacetCutOpts}
   * @param {Object | FacetCutOpts } facets
   */
  addFacetList(facets) {
    for (var co of facets) {
      if (co.constructor?.name == "Object") {
        co = FacetCutOpts(co);
      }
      this.addFacet(co);
    }
  }

  /**
   * Add a single facet to the set.
   * (This is most typically overriden by derived classes)
   * @param {FacetCutOpts} co
   */
  addFacet(co) {
    this.cutterOpts.push(co);
  }

  /**
   * yield the cut option instances as sets of lines appropriate for printing to a terminal or log file.
   * Note that *each* item is a set of lines describing a single {@link FacetCutOpts}
   * @returns {[FacetCutOpts.toLines]}
   */
  *toLines() {
    for (const co of this.cutterOpts) {
      yield co.toLines();
    }
  }

  *toObjects() {
    for (const co of this.cutterOpts) {
      yield co.toObject();
    }
  }

  toJson() {
    return JSON.stringify([...this.toObjects()], null, 2);
  }
}

/**
 * FacetDistinctSelectoSet accumulates a set of {@link FacetCutOpts} ensuring all the
 * selectors are distinct Collisions are detected, removed and collected for
 * further processing.
 */
export class FacetDistinctSelectorSet extends FacetSelectorSet {
  constructor() {
    super();
    this.reset();
  }
  reset() {
    super.reset();
    this.signatures = {};
    this.collisions = [];
  }

  /**
   * Add a single facet cut options instance to the set.  Updating the
   * accumulated signatures and detecting and reconciling any collisions
   * @param {FacetCutOpts} co
   */
  addFacet(co) {
    // filter the signatures array from the facet description read from file.
    // create an update object mapping the new signatures to the cutter opts
    // instance  we just created for the facet.
    const toadd = co.signatures
      .filter((s) => !(s in this.signatures))
      .map((s) => [s, co]);
    if (toadd.length != co.selectors.length) {
      // one or more duplicates
      const toremove = co.signatures.filter((s) => s in signatures);

      // remove from the new cutter opts
      co.removeSignatures(...toremove);

      // go back and remove from all previous cutter opts
      const conflicted = [co];
      for (const sig of toremove) {
        this.signatures[sig].removeSignatures(...toremove);
        conflicted.push(this.signatures[sig]);
      }
      this.collisions.push([toremove, conflicted]);
    }
    this.cutterOpts.push(co);
    this.signatures = { ...this.signatures, ...toadd };
  }
}

export class FacetCutOpts {
  constructor({
    name,
    fileName,
    commonName,
    finderName,
    readerName,
    selectors,
    signatures,
  } = {}) {
    this.name = name;
    this.fileName = fileName;
    this.commonName = commonName;
    this.finderName = finderName;
    this.readerName = readerName;
    this.selectors = [...selectors];
    this.signatures = [...signatures];
  }

  /** removeSignature removes a signature and its associated selector
   * @param {*} signature
   */
  removeSignatures(...signatures) {
    for (const sig of signatures) {
      const selector = signatureSelector(sig);
      this.signatures = [...this.signatures.filter((s) => s != sig)];
      this.selectors = [
        ...this.selectors.filter((s) => s != signatureSelector(sig)),
      ];
    }
  }

  toJson() {
    return JSON.stringify(this.toObject());
  }

  /**
   *
   * @returns {["name, commonName", ..."selector signature"]}
   */
  toLines() {
    const parts = [`${this.name} ${this.commonName}`];
    for (var i = 0; i < this.selectors.length; i++) {
      parts.push(`  ${this.selectors[i]} ${this.signatures[i]}`);
    }
    return parts;
  }
  toObject() {
    return {
      name: this.name,
      fileName: this.filename,
      commonName: this.commonName,
      finderName: this.finderName,
      readerName: this.readerName,
      selectors: this.selectors,
      signatures: this.signatures,
    };
  }
}
