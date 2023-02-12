import { readJson } from "./fsutil.js";
import { Selectors } from "../lib/deployment/diamond/selectors.js";
import { FoundryFileLoader } from "../lib/deployment/loadersfs/foundry/loader.js";
import { FileReader } from "../lib/deployment/filefinder/reader.js";
import { Reporter } from "../lib/reporter.js";
import {
  FacetDistinctSelectorSet,
  FacetCutOpts,
} from "../lib/deployment/diamond/facet.js";

const readers = {
  FileReader: FileReader,
};

export function deployNewDiamond(program, options) {
  const r = Reporter.fromVerbosity(options.verbose);

  const cuts = readJson(options.facets ?? "facets.json").map(o => new FacetCutOpts(o));

  for (const co of cuts) {
    r.out(co.toLines().join("\n"));
    if (!readers[co.readerName]) {
      r.out()
    }
  }
  // const provider = programConnect(program);
}

export function listSelectors(program, options) {
  const r = Reporter.fromVerbosity(options.verbose);

  const loader = new FoundryFileLoader(options, r);
  loader.addDirectoryFinders(...options.directories);

  loader.load();

  const found = new FacetDistinctSelectorSet();

  for (const [name, iface, fileName, finder] of loader.list()) {
    const co = new FacetCutOpts({
      name,
      fileName,
      commonName: finder.commonName(fileName),
      finderName: finder.constructor.name,
      readerName: finder.reader.constructor.name,
      selectors: [],
      signatures: [],
    });

    for (const sel of new Selectors(iface).all()) {
      const f = iface.getFunction(sel);
      co.selectors.push(sel);
      co.signatures.push(f.format());
    }
    found.addFacet(co);
  }

  if (found.collisions.length != 0) {
    r.out('*** collisions ***');
    for (const col of found.collisions) {
      const [toremove, conflicted] = col;
      r.out(`Conflicts found when adding ${conflicted[0].name}`)
      r.out(' ', toremove.join(', '))
      r.out(`  with: ${conflicted.map(con => [con.commonName, con.name].join(':')).join(', ')}`)
    }

    process.exit(1)
  }

  if (options.format == "json") {
    r.out(found.toJson())
    return;
  }

  for (const co of found.toLines()) {
    r.out(co.join("\n"));
  }
}
