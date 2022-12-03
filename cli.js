#! /usr/bin/env node
/* eslint-env es6 */
import { program } from "commander";

import { lastGame, gameState } from "./src/commands/gamestate.js";

program
  .enablePositionalOptions()
  .option("-v, --verbose", "more verbose reporting")
  .option("-u, --url <url>", "provider url", "http://localhost:8300")
  .option("-k, --key <privatekey>", "private key for signing transactions")
  .option("-b, --abi <abifile>");

program
  .command("lastgame <address>")
  .description("get the id of the last game created on the arena contract")
  .action((address, options) => lastGame(program, options, address));

program
  .command("gamestate <address> <gid>")
  .description("report the current state of the game with gid at the address")
  .action((address, gid, options) => gameState(program, options, address, gid));

program.parse();
