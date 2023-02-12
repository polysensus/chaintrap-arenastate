import { FoundryLoader } from "../../foundryloader.js";
import { FileReader } from "../../filefinder/reader.js";
import { FileMatcher } from "../../filefinder/matcher.js";
import { FoundryFileFinder } from "./finder.js";

export class FoundryFileLoader extends FoundryLoader {
  constructor(options, reporter) {
    super(options, reporter);
    this.reader = new FileReader();
    this.matcher = new FileMatcher();
  }
  addDirectoryFinders(...outdirs) {
    const finders = [];
    for (const outdir of outdirs) {
      const f = new FoundryFileFinder(
        outdir,
        this.reporter,
        this.reader,
        this.matcher
      );
      f.include(...this.includes);
      f.exclude(...this.excludes);
      finders.push(f);
    }
    this.addFinders(...finders);
  }
}
