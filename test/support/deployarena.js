import fs from "fs";
import dd from "@polysensus/diamond-deploy";
const { DiamondDeployer, FacetCutOpts, FileReader, Reporter } = dd;

// const diamondDeployJSON = process.env.DIAMOND_DEPLOY_JSON
// if (!diamondDeployJSON) {
//   throw new Error(`DIAMOND_DEPLOY_JSON must be set in the env for now, look in chaintrap-contracts/.local/dev/diamond-deploy.json`);
// }

export async function deployArenaFixture() {
  const [deployer, owner] = await hre.ethers.getSigners();
  const proxy = await deployArena(deployer, owner, {
    /*facets: diamondDeployJSON*/
  });
  return [proxy, owner];
}

export async function deployArena(signer, owner, options = {}) {
  options.commit = true;
  options.diamondOwner = owner;
  options.diamondLoupeName = "DiamondLoupeFacet";
  options.diamondCutName = "DiamondCutFacet";
  options.diamondInitName = "DiamondNew";
  options.diamondInitArgs =
    '[{"typeURIs": ["GAME_TYPE", "TRANSCRIPT_TYPE", "FURNITURE_TYPE"]}]';

  const cuts = readJson(options.facets ?? ".local/dev/diamond-deploy.json").map(
    (o) => new FacetCutOpts(o)
  );

  const deployer = new DiamondDeployer(
    new Reporter(console.log, console.log, console.log),
    signer,
    { FileReader: new FileReader() },
    options
  );
  await deployer.processERC2535Cuts(cuts);
  await deployer.processCuts(cuts);
  if (!deployer.canDeploy())
    throw new Error(
      `can't deploy contracts, probably missing artifiacts or facets`
    );
  const result = await deployer.deploy();
  if (result.isErr()) throw new Error(result.errmsg());
  if (!result.address)
    throw new Error("no adddress on result for proxy deployment");

  return result.address;
}

function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf-8"));
}
