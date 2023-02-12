import { BaseFinder } from "./finder.js";

import { ABILoader } from "./abiloader.js";

export class FoundryLoader extends ABILoader {
  constructor(options, reporter) {
    super(reporter);

    this.excludes = BaseFinder.defaultExcludes();
    this.includes = [];

    if (
      options.includeclasses?.includes(
        BaseFinder.IncludeClassFacet
      )
    ) {
      this.includes.push(...BaseFinder.includeFacets());
    }

    if (options.names) {
      this.includes.push(...options.names);
    }
  }
}
