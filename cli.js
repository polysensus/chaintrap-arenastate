#! /usr/bin/env node
import { program } from "commander";

import { lastGame, gameState } from "./src/commands/gamestate.js";
import { arenaAddress } from "./src/commands/arenaaddress.js";

program
  .enablePositionalOptions()
  .option("-v, --verbose", "more verbose reporting")
  .option("-u, --url <url>", "provider url", "http://localhost:8300")

  .option(
    "-j, --deployjson <deployjson>",
    "derive the areana address from the hardhat deploy formatted json file"
  )

  .option(
    "-d, --deploykey <deploykey>",
    "derive the areana address from private key that deployed the arena contract"
  )
  .option(
    "--deployacc <deployacc>",
    "derive the arena address from the arena contract deployer wallet"
  )
  .option(
    "--deploynonce <nonce>",
    "get the arena address for a particular deployer account nonce rather than the current",
    undefined
  )
  .option(
    "--arena <address>",
    "provide the arena contract address directly",
    undefined
  )

  .option("-k, --key <privatekey>", "private key for signing transactions")
  .option("-b, --abi <abifile>");

program
  .command("arena")
  .description("get the address of the most recently deployed arena contract")
  .action((options) => arenaAddress(program, options));

program
  .command("lastgame")
  .description("get the id of the last game created on the arena contract")
  .action((options) => lastGame(program, options));

program
  .command("gamestate")
  .description("report the current state of the game with gid at the address")
  .option("-g, --gid <gid>")
  .action((options) => gameState(program, options));

program.parse();
