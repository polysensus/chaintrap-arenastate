import { GlobFinder } from "../../filefinder/finder.js";

export class FoundryFileFinder extends GlobFinder {
  constructor(outdir, reporter, reader, matcher) {
    super(
      outdir,
      reporter,
      reader ?? new FileReader(),
      matcher ?? new FileMatcher()
    );
  }

  /** readAbi reads a contract abi from the contents of any file found by this finder.
   * This implementation deals with the specific json output format produced by the foundry tooling.
   * @param {*} foundname - assumed to be a file found by this finder
   * @returns the abi as a javsacript list, compatible with ethers.utils.Interface constructor
   */
  readAbi(foundname) {
    const content = super.readAbi(foundname);
    if (content.abi.length == 0) {
      this.reporter.debug(`ignoring emtpy abi in file ${foundname}`);
      return null;
    }
    return content.abi;
  }
}
