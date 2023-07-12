#! /usr/bin/env node
import * as dotenv from "dotenv";

dotenv.config({ path: process.env.DOTENV_FILE ?? ".env" });

import { program, Option } from "commander";

import { addMaptool } from "./src/commands/maptool.js";
import { addCreategame } from "./src/commands/creategame.js";
import { addJoingame } from "./src/commands/joingame.js";
import { addStartgame } from "./src/commands/startgame.js";
import { addCommitChoice } from "./src/commands/commitchoice.js";
import { addWatchArena } from "./src/commands/watcharena.js";
import { addResolveChoice } from "./src/commands/resolvechoice.js";

program
  .enablePositionalOptions()
  .option("-v, --verbose", "more verbose reporting")
  .option(
    "--deploynonce <nonce>",
    "get the arena address for a particular deployer account nonce rather than the current",
    undefined
  )
  .option(
    "-j, --deployjson <deployjson>",
    "derive the arena address from the hardhat deploy formatted json file"
  )
  .option("-b, --abi <abifile>")
  .option("-m, --map <mapfile>")
  .option("--map-name <name>")
  .option(
    "--codex-filename <filename>",
    "read a map and related materials stored in the encrypted blob codex format"
  )
  .addOption(
    new Option(
      "--codex-password <password>",
      "set the password on the cli. it us *much* better practice to set via the environment variable. the command line leaks the password in un predictable ways."
    ).env("ARENASTATE_MAPTOOL_CODEX_PASSWORD")
  )
  .option("--furniture <furniturefile>");

// Now we are using ERC 2535, the arena address is stable on all chains
program.addOption(
  new Option(
    "--arena <address>",
    "provide the arena contract address directly"
  ).env("ARENASTATE_ARENA")
);

program.addOption(
  new Option(
    "-k, --key <privatekey>",
    "private key for signing transactions"
  ).env("ARENASTATE_USER1_KEY")
);
program.addOption(
  new Option("-u, --url <url>", "provider url").env("ARENASTATE_PROVIDER_URL")
);

program.addOption(
  new Option(
    "-U, --l1-url <l1url>",
    "url for the L1 from which to bridge the ETH"
  ).env("ARENASTATE_OPTIMISM_L1_URL")
);

program.addOption(
  new Option(
    "-d, --deploykey <deploykey>",
    "derive the arena address from private key that deployed the arena contract"
  ).env("ARENASTATE_DEPLOY_KEY")
);

program.addOption(
  new Option(
    "--deployacc <deployacc>",
    "derive the arena address from the arena contract deployer wallet"
  ).env("ARENASTATE_DEPLOY_ACCOUNT")
);

// ---
addMaptool(program);
addWatchArena(program);
addCreategame(program);
addJoingame(program);
addStartgame(program);
addCommitChoice(program);
addResolveChoice(program);
// ---

try {
  program.parse();
} catch (err) {
  if (err.code === "commander.helpDisplayed") process.exit(1);
  console.log(err);
  process.exit(1);
}
