import path from "path";
import pkg from "glob";
const { glob } = pkg;

import { BaseFinder, stripFinderRoot } from "../finder.js";

export class FileFinder extends BaseFinder {
  constructor(reporter, reader, matcher) {
    super(reporter, reader, matcher);
  }

  commonName(filename) {
    return path.basename(filename);
  }
}

export class GlobFinder extends FileFinder {
  constructor(outdir, reporter, reader, matcher) {
    super(reporter, reader, matcher);

    this.outdir = path.resolve(outdir);

    this.glob = `${this.outdir}/**/*.json`;
  }

  commonRoot() {
    return this.outdir;
  }
  commonName(filename) {
    return stripFinderRoot(this, filename);
  }

  find() {
    const found = glob.sync(this.glob).reduce((result, filepath) => {
      // check included first, if no includes are provided the default is to include all
      if (!this.included(filepath)) {
        this.reporter.info(`not included ${filepath}`);
        return result;
      }
      if (this.excluded(filepath)) {
        this.reporter.info(`excluding ${filepath}`);
        return result;
      }
      result.push(filepath);
      return result;
    }, []);
    return found;
  }
}
