#! /usr/bin/env node
import * as dotenv from "dotenv";

dotenv.config({ path: process.env.DOTENV_FILE ?? ".env" });

import { program, Option } from "commander";

import {
  tokenuri,
  lastGame,
  gamelog,
  stateroster,
} from "./src/commands/gamestate.js";
import {
  listplayers,
  joingame,
  commitexituse,
} from "./src/commands/players.js";

import {
  creategame,
  setstart,
  startgame,
  completegame,
  allowexituse,
} from "./src/commands/guardian.js";
import { storegame, defaultGameIconPrompt } from "./src/commands/metadata.js";

import { arenaAddress } from "./src/commands/arenaaddress.js";

import { showProviders } from "./src/commands/providers.js";
import { watchArena } from "./src/commands/watcharena.js";

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
  new Option("--openaikey <key>", "openai api key").env(
    "ARENASTATE_OPENAI_API_KEY"
  )
);
program.addOption(
  new Option("--nftstorage", "nftstorage api key").env(
    "ARENASTATE_NFTSTORAGE_API_KEY"
  )
);

program.addOption(
  new Option(
    "-d, --deploykey <deploykey>",
    "derive the areana address from private key that deployed the arena contract"
  ).env("ARENASTATE_DEPLOY_KEY")
);

program.addOption(
  new Option(
    "--deployacc <deployacc>",
    "derive the arena address from the arena contract deployer wallet"
  ).env("ARENASTATE_DEPLOY_ACCOUNT")
); // On L1:1810633 Gwei    On L2:14923769 Gwei

// ---
// ---

// ---
program
  .command("providers")
  .description("get the address of the most recently deployed arena contract")
  .option("-p, --providers <providersfile>")
  .action((options) => showProviders(program, options));

program
  .command("watch")
  .description("watch for events on the arena contract")
  .option("-p, --providers <providersfile>")
  .option(
    "-w, --which <which>",
    "name of the provider entry in providersfile",
    "caimst"
  )
  .action((options) => watchArena(program, options));

// inspection, no wallet required (the deploy wallet is just a convenient way to work out the contract address)
program
  .command("arena")
  .description("get the address of the most recently deployed arena contract")
  .action((options) => arenaAddress(program, options));

program
  .command("lastgame")
  .description("get the id of the last game created on the arena contract")
  .action((options) => lastGame(program, options));

program
  .command("tokenuri <token>")
  .description("report the game event logs")
  .action((token, options) => tokenuri(program, options, token));

program
  .command("glog")
  .description("report the game event logs")
  .option("-g, --gid <gid>")
  .option("-r, --raw", "raw json format dump")
  .action((options) => gamelog(program, options));

program
  .command("roster")
  .description("determine the current stateroster")
  .option("-g, --gid <gid>")
  .action((options) => stateroster(program, options));

program
  .command("listplayers")
  .description("list the players registered for the game")
  .option("-g, --gid <gid>")
  .option(
    "-s, --scene",
    "full format start and current scene, otherwise just the name & wallet",
    false
  )
  .option("-f, --filter <filter>", "filters: one of ['nostart', 'nothalted'")
  .action((options) => listplayers(program, options));

// ----
// State changing.  The following methods require a wallet key (--key)

// -- nft metadata
program
  .command("storegame")
  .description("store the game nft metadata")
  .option(
    "-i, --iconfile <iconfile>",
    "file on disc to use as icon (default is to generate one)"
  )
  .option(
    "-p, --prompt <prompt>",
    "The prompt string to send to DALL-E to generate the game image. A useful and tested default is provided",
    defaultGameIconPrompt
  )
  .option(
    "-n, --name <name>",
    "Name the game. A generic default is provided",
    "A game of chaintrap"
  )
  .action((options) => storegame(program, options));

// -- guardian transactions
program
  .command("newgame")
  .description("create a new game")
  .option(
    "-g, --maxplayers <max>",
    "maximum number of players allwoed to register",
    5
  )
  .action((options) => creategame(program, options));

program
  .command("setstart <address> <room>")
  .description("set the start location for the player")
  .option("-g, --gid <gid>")
  .action((address, room, options) =>
    setstart(program, options, address, room)
  );

program
  .command("startgame")
  .description("close registration and start the game")
  .option("-g, --gid <gid>")
  .action((options) => startgame(program, options));

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
    "halt the player, when an allow also halts it generaly indicates success/completion or player death",
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
    "character name, 'viking' or 'assasin'",
    "assasin"
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

program.parse();
