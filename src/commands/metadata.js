import { ethers } from "ethers";
import fetch from "node-fetch";
import {
  isFile,
  readHexKey,
  readJson,
  readBinary,
  writeBinary,
  writeText,
} from "./fsutil.js";

import { NFTStorage, File, Blob } from "nft.storage";

import { deriveContractAddress } from "../lib/deriveaddress.js";
import { programConnect } from "./connect.js";

import { getLogger } from "../lib/log.js";

const log = getLogger("arenaaddress");
const out = console.log;

const openaiCompletionsURL = "https://api.openai.com/v1/completions";
const openaiImagesURL = "https://api.openai.com/v1/images/generations";
const nftStorageURL = "https://api.nft.storage";
export const defaultGameIconPrompt =
  "A stylised icon representing a turn based random dungeon crawler game";

export async function fetchGameIconBinary(prompt, apiKey, options) {
  const body = {
    prompt,
    n: 1,
    size: "256x256",
    response_format: "b64_json",
    ...options,
  };
  const path = body.path ?? openaiImagesURL;
  delete body["path"];

  const result = await fetch(path, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const j = await result.json();
  const b64json = j["data"][0]?.b64_json;
  if (!b64json) {
    throw new Error("No data item in response");
  }
  return ethers.utils.base64.decode(b64json);
}

export function nftStorageImageFromBinary(bin, name, type = "image/png") {
  return new File([bin], name, { type });
}

export async function storeERC1155GameMetadata(arenaAddress, map, options) {
  let apiKeyNFTStorage = options.nftstoragekey;
  if (!apiKeyNFTStorage) {
    apiKeyNFTStorage = process.env.ARENASTATE_NFTSTORAGE_API_KEY;
  }
  let apiKeyOpenAI = options.openaikey;
  if (!apiKeyOpenAI) {
    apiKeyOpenAI = process.env.ARENASTATE_OPENAI_API_KEY;
  }

  let bytes;
  if (options.iconfile && isFile(options.iconfile)) {
    bytes = readBinary(options.iconfile);
  } else {
    bytes = await fetchGameIconBinary(
      options.prompt ?? defaultGameIconPrompt,
      apiKeyOpenAI
    );
  }
  const gameIcon = nftStorageImageFromBinary(bytes, "game-icon.png");

  const generatorCommitURL =
    options.generatorCommitURL ??
    "https://chaintrap.hoy.polysensus.io/chaintrap/maptool/commit/";
  const generatorImage =
    options.generatorImage ?? "eu.gcr.io/hoy-dev-1/chaintrap-maptool:main-20";
  const generatorImageDigest =
    options.generatorImageDigest ??
    "sha256:9806aaeb3805f077753b7e94eae2ba371fd0a3cc64ade502f6bc5a99a9aba4e9";

  // TODO: put the generator image in ipfs too
  const metadata = {
    title: "Token Metadata",
    name: options.name ?? "a chaintrap game",
    description:
      "A single game of chaintrap. Anyone can create a game and host a session. When the game is completed the URI will be updated to prove its outcome.",
    image: gameIcon,
    external_url: `https://chaintrap.hoy.polysensus.io/chaintrap/${arenaAddress}/game/{id}/`,
    properties: {
      ...(options.properties ?? {}),
      generator: {
        model_type: "tinykeep",
        url: generatorCommitURL,
        image: generatorImage,
        image_digest: generatorImageDigest,
      },
      vrf_proof: {
        beta: map.vrf_inputs.proof.beta,
        pi: map.vrf_inputs.proof.pi,
        public_key: map.vrf_inputs.proof.public_key,
      },
    },
  };

  const client = new NFTStorage({ token: apiKeyNFTStorage });
  const { token, car } = await NFTStorage.encodeNFT(metadata);
  const stored = await client.storeCar(car);
  return { stored, token };
}

export async function storegame(program, options, provider) {
  const vout = program.opts().verbose ? console.log : () => {};

  // We want the contract address for the metadata

  let acc = program.opts().deployacc;
  let key = program.opts().deploykey;

  if (!key && !acc) {
    throw new Error(
      "To identify the arena contract to interact with, you must supply the deployer wallet key, the deployer wallet, a hardhat deploy.json or the explicit arena contract address"
    );
  }

  if (key) {
    if (isFile(key)) {
      key = readHexKey(key);
    }
    acc = new ethers.Wallet(key).address;
  }

  vout(`deployer wallet: ${acc}`);
  if (!provider) {
    provider = programConnect(program);
  }

  const arena = await deriveContractAddress(
    provider,
    acc,
    program.opts().deploynonce
  );

  // We include the proof in the initial metadata
  const mapfile = program.opts().map;
  if (!mapfile) {
    out(
      "a map file must be provided, use chaintrap-maptool to generate one or use one of its default examples"
    );
    return;
  }

  const map = readJson(mapfile);

  let apiKeyNFTStorage = program.opts().nftstoragekey;
  if (!apiKeyNFTStorage) {
    apiKeyNFTStorage = process.env.ARENASTATE_NFTSTORAGE_API_KEY;
  }
  let apiKeyOpenAI = program.opts().openaikey;
  if (!apiKeyOpenAI) {
    apiKeyOpenAI = process.env.ARENASTATE_OPENAI_API_KEY;
  }

  const prompt = options.prompt ?? defaultGameIconPrompt;

  let bytes;
  if (options.iconfile && isFile(options.iconfile)) {
    bytes = readBinary(options.iconfile);
  } else {
    bytes = await fetchGameIconBinary(prompt, apiKeyOpenAI);
  }
  const gameIcon = nftStorageImageFromBinary(bytes, "game-icon.png");

  // TODO: put the generator image in ipfs too
  const metadata = {
    title: "Token Metadata",
    name: options.name ?? "a chaintrap game",
    description:
      "A single game of chaintrap. Anyone can create a game and host a session. When the game is completed the URI will be updated to prove its outcome.",
    image: gameIcon,
    external_url: `https://chaintrap.hoy.polysensus.io/chaintrap/${arena}/game/{id}/`,
    properties: {
      generator: {
        model_type: "tinykeep",
        url: "https://chaintrap.hoy.polysensus.io/chaintrap/maptool/commit/",
        image: "eu.gcr.io/hoy-dev-1/chaintrap-maptool:main-20",
        image_digest:
          "sha256:9806aaeb3805f077753b7e94eae2ba371fd0a3cc64ade502f6bc5a99a9aba4e9",
      },
      vrf_proof: {
        beta: map.vrf_inputs.proof.beta,
        pi: map.vrf_inputs.proof.pi,
        public_key: map.vrf_inputs.proof.public_key,
      },
    },
  };

  const client = new NFTStorage({ token: apiKeyNFTStorage });
  const stored = await client.store(metadata);
  out(stored.url);
}
