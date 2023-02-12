import { ethers } from "ethers";
import { programConnect } from "./connect.js";
import { resolveHardhatKey } from "./hhkeys.js";
import { readJson } from "./fsutil.js";
import {
  Selectors,
  FacetCutAction,
} from "../lib/deployment/diamond/selectors.js";
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

export function loadCutOptions(reader, co) {
  const solOutput = reader.readJson(co.fileName);
  const iface = new ethers.utils.Interface(solOutput.abi);
  return [iface, solOutput.bytecode, solOutput];
}

export async function deployContract(iface, bytecode, signer, co, ...args) {
  const factory = new ethers.ContractFactory(iface, bytecode, signer);

  if (signer) {
    const facet = await factory.deploy(...args);
    await facet.deployed();
    const msg = `deployed facet ${co.name}@${facet.address}`;
    return [facet.address, null, msg];
  } else {
    const tx = factory.getDeployTransaction();
    return [
      ethers.constants.AddressZero,
      tx,
      `deploy calldata for facet ${co.name}`,
    ];
  }
}

export async function deployNewDiamond(program, options) {
  const r = Reporter.fromVerbosity(options.verbose);

  const opts = program.opts();
  const deploykey = resolveHardhatKey(opts.deploykey);
  const signer = programConnect(program, false, deploykey);

  const cuts = readJson(options.facets ?? "facets.json").map(
    (o) => new FacetCutOpts(o)
  );

  var diamond, diamondCut, diamondInit;

  const facetCuts = [];
  const results = [];
  const errors = [];

  const isOffline = () => !deploykey || !!opts.offline;
  const getSigner = () => (!isOffline() ? signer : null);
  const isError = (v) => v?.constructor?.name === "Error";

  const exit = (msg, code = undefined) => {
    // if there are errors co-erce any code not > 0 (including undefined) to 1.
    // If there are no errors co-erce an undefined code to 0
    code =
      errors.length === 0
        ? typeof code === "undefined"
          ? 0
          : code
        : code > 0
        ? code
        : 1;

    if (errors.length) {
      for (const [co, err] of errors)
        r.out(`error creating deploy transaction for ${co.commonName} ${err}`);
    }
    if (msg) r.out(msg);
    process.exit(code);
  };
  // exitok will exit with non zero status if there are recorded errors
  const exitok = () => exit(undefined, undefined);

  const tryDeploy = async function (iface, bytecode, co, ...args) {
    try {
      // facets are not allowed constructor arguments
      const [address, tx, msg] = await deployContract(
        iface,
        bytecode,
        getSigner(),
        co,
        ...args
      );
      r.out(msg);
      results.push(tx ?? msg);
      return tx ?? address;
    } catch (err) {
      errors.push([co, err]);
      return err;
    }
  };

  for (const co of cuts) {
    const reader = readers[co.readerName];
    if (!readers) {
      r.out(`reader ${co.readerName} not supported, skipping ${co.fileName}`);
      continue;
    }

    var address;

    const [iface, bytecode] = loadCutOptions(reader, co);
    co.iface = iface;
    co.bytecode = bytecode;

    // capture the Diamond, it deploys last and requires constructor arguments.
    if (co.name == options.diamondName) {
      diamond = co;
      continue;
    }

    // never delegated
    co.removeSignatures("init(bytes)");

    address = await tryDeploy(iface, bytecode, co);
    if (isError(address)) continue;
    co.address = address;
    co.iface = iface;

    if (co.name == options.diamondCutName) {
      diamondCut = co;
      // the diamondCut is added in the diamond constructor
      continue;
    }

    if (co.name == options.diamondInitName) {
      diamondInit = co;
      // this isn't a facet
      continue;
    }

    if (!isError(address)) {
      facetCuts.push({
        facetAddress: address,
        action: FacetCutAction.Add,
        functionSelectors: co.selectors,
      });
    }
  }

  if (diamond && !isOffline() && errors.length === 0) {
    var co = diamond;

    diamond.address = await tryDeploy(
      co.iface,
      co.bytecode,
      co,
      ethers.utils.computeAddress(deploykey),
      diamondCut.address
    );
    if (isError(address))
      exit(`failed to deploy diamond ${co.name} ${address}`);

    if (!diamondCut) exit(`DiamondCut facet not deployed, exiting`, 1);
    if (!diamondInit)
      exit(
        `Diamond initialiser contract ${options.diamondInitName} not deployed, exiting`,
        1
      );

    const args = JSON.parse(options.diamondInitArgs);
    const initCalldata = diamondInit.iface.encodeFunctionData("init", [args]);

    const cutter = new ethers.Contract(
      diamond.address,
      diamondCut.iface,
      getSigner()
    );
    const tx = await cutter.diamondCut(
      facetCuts,
      diamondInit.address,
      initCalldata
    );
    const receipt = await tx.wait();
    if (!receipt.status) exit(`Diamond upgrade failed: ${tx.hash}`, 1);
    r.out(`Diamond upgrade success: ${tx.hash}`);
  }

  if (isOffline()) {
    r.out(
      JSON.stringify(
        results.map((r) => r.data),
        null,
        2
      )
    );
  }
  exitok();
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
