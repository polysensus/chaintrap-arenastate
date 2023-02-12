import path from "path";
// import fs from "fs";

import { BaseMatcher } from "../finder.js";

export class FileMatcher extends BaseMatcher {
  /**
   * return true if the matcher matches filepath and false otherwise.
   * - If the matcher is a RegExp instance exec and return true if the result is not null
   * - If matcher is the empty string return false
   * - If the matcher is a string return true if the filepath ends with matcher
   * - If the matcher is a string return true if the basename of filepath with '.json' removed equals the matcher
   * @param {*} filepath absoloute path to source
   * @param {*} matcher matcher is a RegExp or a string
   * @returns {boolean}
   */
  match(filepath, matcher) {
    if (super.match(filepath, matcher)) return true;
    if (path.basename(filepath, ".json") === matcher) return true;
  }
}
