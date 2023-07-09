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

/*
program
  .command("completegame")
  .description("complete the game")
  .option("-g, --gid <gid>")
  .action((options) => completegame(program, options));
*/

try {
  program.parse();
} catch (err) {
  console.log(err);
  process.exit(1);
}
