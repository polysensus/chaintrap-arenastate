import { Option } from "commander";
import fetch from "node-fetch";
import { ethers } from "ethers";

import { readJson } from "./fsutil.js";
import { programConnectArena } from "./connect.js";
import { LogicalTopology } from "../lib/maptrie/logical.js";
import { GameMint } from "../lib/mint/gamemint.js";

export function addCreategame2(program) {
  program
    .command("creategame2")
    .description("create a new game")
    .option("--max-participants <max>", "maximum number of participants", 5)
    .option(
      "--map <name>",
      `
name of a specific map in the map collection file. if the file has a single
entry, it is used by default. if it has many entries, the lexically first entry
is selected`,
      undefined
    )
    .option(
      "--name <name>",
      "A name for the ERC1155 metadata",
      "A chaintrap game"
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
      ).env("ARENASTATE_OPENAI_IMAGES_URL")
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
    .action((options) => creategame2(program, options));
}

const out = console.log;
let vout = () => {};

async function creategame2(program, options) {
  if (program.opts().verbose) vout = out;
  const mapfile = program.opts().map;
  if (!mapfile) {
    out(
      "a map file must be provided, use chaintrap-maptool to generate one or use one of its default examples"
    );
    return;
  }
  const arenaAddress = program.opts().arena;
  if (!arenaAddress)
    throw new Error("The arena address must be supplied for this command");

  const arena = await programConnectArena(program, options);
  const iface = arena.getFacetInterface("ERC1155ArenaFacet");

  const collection = readJson(mapfile);
  const topo = LogicalTopology.fromCollectionJSON(collection, options.map);
  const trie = topo.encodeTrie();

  const minter = new GameMint();
  const mdOptions = { ...options, fetch };
  if (options.gameIconFilename && isFile(options.gameIconFilename)) {
    mdOptions.gameIconBytes = readBinary(options.gameIconFilename);
  }

  const mapRootLabel = "chaintrap-dungeon:static";
  minter.configureMetadataOptions(mdOptions);
  minter.configureNFTStorageOptions(mdOptions);
  minter.configureGameIconOptions(mdOptions);
  minter.configureMaptoolOptions(mdOptions);
  minter.configureMapOptions({
    ...mdOptions,
    mapRootLabel,
    topology: topo,
    trie,
  });

  await minter.prepareGameImage();
  const metadataUrl = await minter.publishMetadata();
  out(metadataUrl);

  const r = await minter.mint(arena);
  out(r.transactionHash);
  const o = {
    roots: {},
  };
  for (const log of r.logs) {
    try {
      const parsed = iface.parseLog(log);
      out(parsed.name);
      switch (parsed.name) {
        case "TransferSingle":
          o.id = parsed.args.id;
          o.idHex = o.id.toHexString();
          o.creator = parsed.args.to;
          break;
        case "URI":
          o.uri = parsed.args.tokenURI;
          break;
        case "SetMerkleRoot":
          o.roots[ethers.utils.parseBytes32String(parsed.args.label)] =
            ethers.utils.hexlify(parsed.args.root);
          break;
        case "GameCreated":
          o.maxParticipants = parsed.args.maxParticipants.toNumber();
          break;
      }
    } catch (err) {
      out(`${err}`);
    }
  }
  o.id = o.idHex;
  delete o.idHex;
  out(`${JSON.stringify(o, null, "  ")}`);
}
