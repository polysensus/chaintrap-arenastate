import { programConnect } from "./connect.js";
import { resolveHardhatKey } from "./hhkeys.js";
import { readJson } from "./fsutil.js";
import { Selectors } from "../lib/deployment/diamond/selectors.js";

import { DiamondDeployer } from "../lib/deployment/diamond/deploy.js";

import { FoundryFileLoader } from "../lib/deployment/loadersfs/foundry/loader.js";
import { FileReader } from "../lib/deployment/filefinder/reader.js";
import { Reporter } from "../lib/reporter.js";
import {
  FacetDistinctSelectorSet,
  FacetCutOpts,
} from "../lib/deployment/diamond/facet.js";

const readers = {
  FileReader: new FileReader(),
};

export async function deployNewDiamond(program, options) {
  const r = Reporter.fromVerbosity(options.verbose);

  const opts = program.opts();
  const deploykey = resolveHardhatKey(opts.deploykey);
  const signer = programConnect(program, false, deploykey);

  const cuts = readJson(options.facets ?? "facets.json").map(
    (o) => new FacetCutOpts(o)
  );

  const deployer = new DiamondDeployer(r, signer, readers, options);

  const isOffline = () => !deploykey || !!opts.offline;

  const exit = (msg, code = undefined) => {
    // if there are errors co-erce any code not > 0 (including undefined) to 1.
    // If there are no errors co-erce an undefined code to 0
    code =
      deployer.errors.length === 0
        ? typeof code === "undefined"
          ? 0
          : code
        : code > 0
        ? code
        : 1;

    deployer.reporterrs();
    if (msg) r.out(msg);
    process.exit(code);
  };
  // exitok will exit with non zero status if there are recorded errors
  const exitok = (msg) => exit(msg, undefined);

  await deployer.processCuts(cuts);
  var result;
  if (deployer.canDeploy()) {
    result = await deployer.deploy();
    if (result.isErr()) exit(result.errmsg(), 1)
  }

  if (isOffline()) {
    deployer.report();
  }
  exitok(result.msg);
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
    r.out("*** collisions ***");
    for (const col of found.collisions) {
      const [toremove, conflicted] = col;
      r.out(`Conflicts found when adding ${conflicted[0].name}`);
      r.out(" ", toremove.join(", "));
      r.out(
        `  with: ${conflicted
          .map((con) => [con.commonName, con.name].join(":"))
          .join(", ")}`
      );
    }

    process.exit(1);
  }

  if (options.format == "json") {
    r.out(found.toJson());
    return;
  }

  for (const co of found.toLines()) {
    r.out(co.join("\n"));
  }
}
