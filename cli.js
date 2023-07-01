#! /usr/bin/env node
import * as dotenv from "dotenv";

dotenv.config({ path: process.env.DOTENV_FILE ?? ".env" });

import { program, Option } from "commander";

import { addCreategame2 } from "./src/commands/creategame2.js";
import { addJoingame2 } from "./src/commands/joingame2.js";
import { addStartgame2 } from "./src/commands/startgame2.js";
import { addWatchArena } from "./src/commands/watcharena.js";

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
  .option("-m, --map <mapfile>");

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
); // On L1:1810633 Gwei    On L2:14923769 Gwei

// ---
addWatchArena(program);
addCreategame2(program);
addJoingame2(program);
addStartgame2(program);
// ---

/*
program
  .command("completegame")
  .description("complete the game")
  .option("-g, --gid <gid>")
  .action((options) => completegame(program, options));

program
  .command("allowexituse")
  .description("validate and confirm the most recent exit uses for the players")
  .option("-g, --gid <gid>")
  .option("-p, --player <player>", "allow only one specific player")
  .option("-c, --commit", "default is dry-run, set -c to issue the transaction")
  .option(
    "-H, --halt",
    "halt the player, when an allow also halts it generally indicates success/completion or player death",
    false
  )
  .action((options) => allowexituse(program, options));

// -- aspirant transactions
program
  .command("join <nickname>")
  .description("join the game, defaults to most recently created")
  .option("-g, --gid <gid>")
  .option(
    "-c, --character <character>",
    "character name, 'viking' or 'assassin'",
    "assassin"
  )
  .action((nickname, options) => joingame(program, options, nickname));

program
  .command("commitexituse")
  .description("aspirant commits to the use of a room exit")
  .option("-g, --gid <gid>")
  .option(
    "-e, --sideexit <sideexit>",
    "<side>:<exit-index> room side and exit index in that side to leave via",
    "0:0"
  )
  .action((options) => commitexituse(program, options));
*/

program.parse();
