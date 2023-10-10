import { Option } from "commander";
import fetch from "node-fetch";
import { ethers } from "ethers";

import {
  prepareGuardian,
  prepareArena,
  fetchCodex,
} from "./prepareguardian.js";
import { ArenaEvent } from "../lib/arenaevent.js";
import { EventParser } from "../lib/chainkit/eventparser.js";
import { ABIName } from "../lib/abiconst.js";
import { defaultGameIconPrompt } from "../lib/erc1155metadata/gamecreator.js";
import { generateImageBinary } from "../lib/openai/imageprompt.js";
import { openaiImagesURL } from "../lib/openai/config.js";
import { readBinaryData } from "./data.js";

export function addCreategame(program) {
  program
    .command("creategame")
    .description("create a new game")
    .option("--max-participants <max>", "maximum number of participants", 5)
    .option(
      "--map-root-label <name>",
      `
      The merkle root that commits the the game map and dungeon load to the chain is identified by this label.
`,
      "chaintrap-dungeon:static"
    )
    .option(
      "--name <name>",
      "A name for the ERC1155 metadata",
      "A chaintrap game"
    )
    .option(
      "--description",
      "The nft metadata description",
      "A single chaintrap game transcript, find polysensus on discord for more info"
    )
    .option(
      "--codex-publish",
      "set to save the AES encrypted blob codex with the map data in the nft metadata"
    )
    .option(
      "--codex-from-disc",
      "set to force reading the codex from disc (rather than token metadata)"
    )

    .option(
      "--icon-generate",
      "use openai/dall-e to generate an icon for the game session"
    )
    .option(
      "--icon-prompt <prompt>",
      "The prompt text to send to DALL-E",
      defaultGameIconPrompt
    )
    .option(
      "--description <description>",
      "description on the ERC 1155 metadata",
      "an ownable chaintrap game instance"
    )
    .addOption(
      new Option(
        "--maptool-url <url>",
        "the url of the service that generated the map"
      ).env("ARENASTATE_MAPTOOL_URL")
    )
    .addOption(
      new Option(
        "--maptool-image <image>",
        "the docker image name for map generator"
      ).env("ARENASTATE_MAPTOOL_IMAGE")
    )
    .addOption(
      new Option(
        "--maptool-image-digest <image-digest>",
        "the docker image digest the map generator"
      ).env("ARENASTATE_MAPTOOL_IMAGE_DIGEST")
    )
    .addOption(
      new Option(
        "--openai-image-prompt <prompt>",
        "The text prompt for DALL-E image generation"
      ).default(
        "A stylised icon representing a turn based random dungeon crawler game"
      )
    )
    .addOption(
      new Option(
        "--openai-api-key <key>",
        "openai api key, used unless a game icon is provided"
      ).env("ARENASTATE_OPENAI_API_KEY")
    )
    .addOption(
      new Option(
        "--openai-images-url <url>",
        "url to the openai dall-e image generation endpoint"
      )
        .env("ARENASTATE_OPENAI_IMAGES_URL")
        .default(openaiImagesURL)
    )
    .addOption(
      new Option(
        "--game-icon-filename <filename>",
        "read the game icon from this file"
      )
    )
    .addOption(
      new Option(
        "--nftstorage-game-icon-filename <filename>",
        "the filename to assign to the image when it is stored in ipfs"
      ).default("game-icon.png")
    )

    .addOption(
      new Option("--nftstorage-api-key <api-key>", "nftstorage api key").env(
        "ARENASTATE_NFTSTORAGE_API_KEY"
      )
    )
    .addOption(
      new Option(
        "--nftstorage-url <url>",
        "the url for the nftstorage service"
      ).env("ARENASTATE_NFTSTORAGE_URL")
    )
    .action((options) => creategame(program, options));
}

const out = console.log;
let vout = () => {};

async function creategame(program, options) {
  if (program.opts().verbose) vout = out;

  const arena = await prepareArena(program, options);
  const eventParser = new EventParser(arena, ArenaEvent.fromParsedEvent);

  const guardian = await prepareGuardian(eventParser, program, options);

  // Note: this will require a furnitureFile if furniture is not alread present in the existing codex data.
  const { codex } = await fetchCodex(program, options);

  // everything gets an icon, but don't hit openai unless asked.
  let gameIconBytes = readBinaryData("gameicons/game-ico-1.png");
  if (options.iconGenerate)
    gameIconBytes = await generateImageBinary(
      options.openaiImagesUrl,
      options.iconPrompt,
      { openaiApiKey: options.openaiApiKey, fetch }
    );

  guardian.setupTrial(codex, { ikey: 0 });
  const result = (
    await guardian.mintGame({
      codexPublish: options.codexPublish,
      name: options.name,
      description: options.description,
      gameIconBytes,
      fetch,
    })
  ).result;

  const o = { roots: {} };

  for (const event of result.events()) {
    const parsed = event.parsedLog;
    switch (event.name) {
      case "TransferSingle":
        o.id = event.gid.toHexString();
        o.creator = parsed.args.to;
        break;
      case "URI":
        o.uri = parsed.args.tokenURI;
        break;
      case ABIName.TranscriptMerkleRootSet:
        o.roots[ethers.utils.parseBytes32String(parsed.args.label)] =
          ethers.utils.hexlify(parsed.args.root);
        break;
      case ABIName.TranscriptCreated:
        o.registrationLimit = parsed.args.registrationLimit.toNumber();
        break;
    }
  }
  out(`${JSON.stringify(o, null, "  ")}`);
}
