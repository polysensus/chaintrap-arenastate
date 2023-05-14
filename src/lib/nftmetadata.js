import { ethers } from "ethers";

import { NFTStorage, File } from "nft.storage";

import { getLogger } from "./log.js";

const log = getLogger("nftstorage");

/**
 * Derive the following from env and the given prefix (which may be empty)
 *
 *   defaultGameIconPrompt: {prefix}DEFAULT_GAME_ICON_PROMPT
 *   defaultGameIconSize: {prefix}DEFAULT_GAME_ICON_SIZE
 *   openaiCompletionsURL: {prefix}OPENAI_COMPLETIONS_URL
 *   openaiImagesURL: {prefix}OPENAI_IMAGES_URL
 *   nftstorageURL: {prefix}NFTSTORAGE_URL
 *   maptoolCommitURL: {prefix}MAPTOOL_COMMIT_URL
 *   maptoolImage: {prefix}MAPTOOL_IMAGE
 *   maptoolImageDigest: {prefix}MAPTOOL_IMAGE_DIGEST
 *
 */
export function gameMetadataOptionsFromEnv(env, prefix) {
  const options = {
    defaultGameIconPrompt:
      env[`${prefix}DEFAULT_GAME_ICON_PROMPT`] ?? defaultGameIconPrompt,
    defaultGameIconSize:
      env[`${prefix}DEFAULT_GAME_ICON_SIZE`] ?? defaultImageSize,
    openaiCompletionsURL:
      env[`${prefix}OPENAI_COMPLETIONS_URL`] ?? openaiCompletionsURL,
    openaiImagesURL: env[`${prefix}OPENAI_IMAGES_URL`] ?? openaiImagesURL,
    nftstorageURL: env[`${prefix}NFTSTORAGE_URL`] ?? nftStorageURL,
    maptoolCommitURL: env[`${prefix}MAPTOOL_COMMIT_URL`] ?? maptoolCommitURL,
    maptoolImage: env[`${prefix}MAPTOOL_IMAGE`] ?? maptoolImage,
    maptoolImageDigest:
      env[`${prefix}MAPTOOL_IMAGE_DIGEST`] ?? maptoolImageDigest,
  };
  return options;
}

export function gameMetadataOptionsFromPrivateEnv(env, prefix) {
  const options = {
    openaiAPIKey: env[`${prefix}OPENAI_APIKEY`],
    nftstorageAPIKey: env[`${prefix}NFTSTORAGE_APIKEY`],
  };
  return options;
}

const openaiCompletionsURL = "https://api.openai.com/v1/completions";
const openaiImagesURL = "https://api.openai.com/v1/images/generations";
const nftStorageURL = "https://api.nft.storage";
export const defaultGameIconPrompt =
  "A stylised icon representing a turn based random dungeon crawler game";

export const defaultImageSize = "256x256";

const maptoolCommitURL =
  "https://chaintrap.hoy.polysensus.io/chaintrap/maptool/commit";
const maptoolImage = "eu.gcr.io/hoy-dev-1/chaintrap-maptool:main-20";
const maptoolImageDigest =
  "sha256:9806aaeb3805f077753b7e94eae2ba371fd0a3cc64ade502f6bc5a99a9aba4e9";

export async function generateGameIconBinary(options) {
  const body = {
    prompt: options.openaiImagePrompt,
    n: 1,
    size: "256x256",
    response_format: "b64_json",
  };
  const path = options.openaiImagesUrl;
  delete body["path"];

  const result = await fetch(path, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.openaiApiKey}`,
    },
  });
  const j = await result.json();
  const b64json = j["data"][0]?.b64_json;
  if (!b64json) {
    throw new Error("No data item in response");
  }
  return ethers.utils.base64.decode(b64json);
}

export async function fetchGameIconBinary(path, prompt, options) {
  if (!options.fetch)
    throw new Error("you must provide a fetch implementation");
  if (!options.openaiAPIKey)
    throw new Error("the openaiAPIKey option is required");
  const body = {
    prompt,
    n: 1,
    size: defaultImageSize,
    response_format: "b64_json",
    ...options.openai_image_options,
  };

  log.debug("prompt body", body);

  const result = await options.fetch(path, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.openaiAPIKey}`,
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

export async function storeERC1155GameMetadata(
  public_proof,
  metadata,
  options
) {
  if (options.nftstorageApiKey)
    options.nftstorageAPIKey = options.nftstorageApiKey;
  if (options.nftstorageApiKey)
    options.nftstorageAPIKey = options.nftstorageApiKey;
  if (options.options.openaiApiKey)
    options.openaiAPIKey = options.options.openaiApiKey;

  if (!options.gameIconBytes) {
    if (!options.openaiImagesURL)
      throw new Error(
        "you must provide the url for openai image generation api OR you must instead provide the image bytes to use"
      );
    if (!options.fetch)
      throw new Error("you must provide a fetch implementation");
    if (!options.openaiAPIKey)
      throw new Error("the openaiAPIKey option is required");
  }

  if (!options.nftstorageAPIKey)
    throw new Error("the nftstoragekey option is required");

  let gameIconBytes = options.gameIconBytes;
  if (!gameIconBytes) {
    gameIconBytes = await fetchGameIconBinary(
      options.openaiImagesURL,
      options.prompt ?? defaultGameIconPrompt,
      options
    );
  }
  gameIcon = nftStorageImageFromBinary(
    gameIconBytes,
    options.filename ?? "game-icon.png"
  );

  metadata = {
    title: "Token Metadata",
    name: metadata.name ?? "a chaintrap game",
    description:
      metadata.description ??
      "A single game of chaintrap. Anyone can create a game and host a session. When the game is completed the URI will be updated to prove its outcome.",
    ...metadata,
    image: gameIcon,
    external_url: metadata.external_url,
    properties: {
      ...(options.properties ?? {}),
      generator: {
        model_type: "tinykeep",
        url: options.maptoolCommitURL,
        image: options.maptoolImage,
        image_digest: options.maptoolImageDigest,
      },
      // beta, pi, public_key from map.vrf_inputs.proof, trie root commitments
      public_proof,
    },
  };

  const client = new NFTStorage({
    token: options.nftstorageAPIKey,
    endpoint: options.nftstorageURL,
  });

  log.debug("encodeNFT metadata", metadata);

  const { token, car } = await NFTStorage.encodeNFT(metadata);
  const stored = await client.storeCar(car);
  return { stored, token };
}
