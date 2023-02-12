#! /usr/bin/env node
import * as dotenv from "dotenv";
dotenv.config();

import { program, Option } from "commander";

import { deployNewDiamond, listSelectors } from "./src/commands/deploy.js";

program.addOption(
  new Option(
    "-d, --deploykey <key>",
    "derive the areana address from private key that deployed the arena contract"
  ).env("ARENASTATE_DEPLOYKEY")
);

program.addOption(
  new Option("-u, --url <url>", "provider url", "http://localhost:8300").env(
    "ARENASTATE_PROVIDER_URL"
  )
);

program
  .command("diamond-new")
  .description(
    `deploy a new diamond, this deploys a new proxy contract with empty state and cuts in the facets`
  )
  .enablePositionalOptions()
  .combineFlagAndOptionalValue(false)
  .option("-O, --offline", "prepare unsigned transaction payloads")
  .option("--diamond-name", "name of diamond contract", "Diamond")
  .option("--diamond-init-name", "name of diamond contract", "DiamondNew")
  .option(
    "--diamond-init-args",
    "json formated args for the init contract name",
    '[{"typeURIs":[]}]'
  )
  .option("--diamond-cut-name", "name of diamond contract", "DiamondCutFacet")
  .option(
    "-f, --facets <facets>",
    "a file describing the named facets to add. must include at least Diamond, DiamondLoupeFacet and OwnershipFacet"
  )
  .action((options) => deployNewDiamond(program, options));

program
  .command("list")
  .summary("list the selectors for each discovered abi file")
  .description(
    `list the contract and libary selectors. Use --format json to
produce output that can be consumed by deploy-new and deploy`
  )
  .option("-v, --verbose [count]", "more verbose reporting")
  .option("-i, --directories <includedirs...>")
  .option(
    "-I, --includeclasses <classes...>",
    "facet is the only supported class for now"
  )
  .option("-n, --names <names...>")
  .option("-F, --format <format>")
  .action((options) => listSelectors(program, options));

program.parse();
