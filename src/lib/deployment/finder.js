export function stripFinderRoot(finder, filename) {
  const commonRoot = finder.commonRoot();
  var commonname = filename;
  const i = commonname.indexOf(commonRoot);
  if (i == 0) {
    commonname = filename.slice(commonRoot.length);
    if (commonname[0] == "/") commonname = commonname.slice(1);
  }
  return commonname;
}

/**
 * Defines the interface expected by {@link BaseFinder} for its matcher instance and provides a browser / cli neutral implementation
 */
export class BaseMatcher {
  /**
   * return true if the matcher matches filepath and false otherwise.
   * - If the matcher is a RegExp instance exec and return true if the result is not null
   * - If matcher is the empty string return false
   * - If the matcher is a string return true if the filepath ends with matcher
   * @param {*} filepath absoloute path to source
   * @param {*} matcher matcher is a RegExp or a string
   * @returns {boolean}
   */
  match(filepath, matcher) {
    if (matcher.constructor?.name === "RegExp") {
      return matcher.exec(filepath) != null;
    }
    if (matcher === "") return false;
    if (filepath.endsWith(matcher)) return true;
  }
}

/**
 * Defines the interface expected by {@link BaseFinder} for its reader instance. The default implementation throws.
 */
export class BaseReader {
  /** readAbi reads a contract abi from the contents of any source found by the finder it is used by.
   * The base implementation throws, there is no possible neutral implementation
   * @param {*} foundname - assumed to be a file found by this finder
   * @returns the abi as a javsacript list, compatible with ethers.utils.Interface constructor
   */
  readAbi(foundname) {
    throw new Error(`not implemented by ${this.constructor.name}`);
  }
}

export class BaseFinder {
  static IncludeClassFacet = "facet";

  // note these defaults are intended to be used for file path and url path matching

  static defaultExcludes() {
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions/Character_Classes
    // matches file names like some/path/Foo.t.sol
    return [
      new RegExp(/.*Test\w*\.json/),
      new RegExp(/.*[A-Za-z]\w*\.t\.sol\//),
    ];
  }

  static includeFacets() {
    return [new RegExp(/.*[A-Za-z]\w*Facet\.json/)];
  }

  constructor(reporter, reader, matcher) {
    if (!reader)
      throw new Error(
        "a reader instance must be provided, you probably want a FileReader instance"
      );

    this.reader = reader;

    this.matcher = matcher ?? new BaseMatcher();

    this.excludes = [];

    this.includes = [];

    if (!reporter) {
      reporter = new Reporter(console.log, console.log);
    }
    this.reporter = reporter;
  }

  commonName(filename) {
    const parts = filename.split("/");
    return parts[parts.length - 1];
  }

  exclude(...excludes) {
    this.excludes = [...this.excludes, ...excludes];
  }
  include(...includes) {
    this.includes = [...this.includes, ...includes];
  }

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
  match(filepath, match) {
    return this.matcher.match(filepath, match);
  }

  /**
   * return true if filepath is excluded by the finder
   * @param {string} filepath
   * @returns {boolean}
   */
  excluded(filepath) {
    for (const exclude of this.excludes) {
      if (this.match(filepath, exclude)) {
        return true;
      }
    }
    return false;
  }

  /**
   * return true if filepath is included by the finder
   * @param {string} filepath
   * @returns {boolean}
   */
  included(filepath) {
    // if there are no explicit includes, all are included by default
    if (this.includes.length == 0) return true;
    for (const include of this.includes) {
      if (this.match(filepath, include)) {
        return true;
      }
    }
    return false;
  }

  /** readAbi reads a contract abi from the contents of any source found by this finder.
   * @param {*} foundname - assumed to be a source found by this finder
   * @returns the abi as a javsacript list, compatible with ethers.utils.Interface constructor
   */
  readAbi(foundname) {
    return this.reader.readAbi(foundname);
  }
}
