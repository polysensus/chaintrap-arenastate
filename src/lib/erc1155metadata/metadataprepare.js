import { ethers } from "ethers";
import { NFTStorage } from "nft.storage";

import { fileObjectFromBinary } from "../chainkit/nftstorage.js";
import { conditionInput } from "../maptrie/objects.js";
import { ObjectType } from "../maptrie/objecttypes.js";
import { rootLabel } from "../maptrie/logical.js";
import { blobcodexMetadataProperty } from "../chainkit/secretblobsipfs.js";
export const trialSetupPropertyFilename = "trial-setup.json";

export const defaultGameIconPrompt =
  "A stylised icon representing a turn based random dungeon crawler game";

const defaultMaxParticipants = 5;
const defaultParticipanInitialLives = 1;

export async function publishTrialMetadata(metadata, options) {
  if (!options.imageBytes) throw new Error("option imageBytes is mandatory");

  metadata.image = fileObjectFromBinary(
    options.imageBytes,
    options.imageFilename ?? "game-icon.png",
    "image/png"
  );

  const client = new NFTStorage({ token: options.nftstorageApiKey });
  const { token, car } = await NFTStorage.encodeNFT(metadata);
  return {
    stored: await client.storeCar(car),
    token, // token.url = tokenURI
    car,
  };
}

/**
 * Creates the metadata for a game
 * @param {{
 *  comment?:string,
 *  name?:string,
 *  model:any,
 *  model_type:string,
 *  vrf_inputs:{
 *    alpha:string,
 *    proof: {beta:string,pi:string,public_key:string},
 *  secret:string, seed:string}}} map
 * @param { import('@openzeppelin/merkle-tree').StandardMerkleTree } trie
 * @param {MetadataOptions} options - The options configuring the top level nft metadata
 */
export function prepareTrialMetadata(map, trie, options) {
  if (!options.name) throw new Error("A name is required");
  if (!options.description) throw new Error("A description is required");
  if (!map?.vrf_inputs) throw Error("Missing vrf_inputs on map");
  if (!map?.vrf_inputs.proof)
    throw Error(
      "GameMetadataPreparer# invalid topology, missing vrf_inputs.proof"
    );
  if (!map?.vrf_inputs.proof.beta)
    throw Error(
      "GameMetadataPreparer# invalid topology, missing vrf_inputs.proof.beta"
    );

  // TODO: public_key has moved about a bit, settle on one spot at some point.
  const public_key =
    map?.vrf_inputs?.proof?.public_key ?? map?.vrf_inputs?.public_key;
  if (!public_key)
    throw Error(
      "GameMetadataPreparer# invalid topology, missing vrf_inputs.proof.public_key or vrf_inputs.public_key"
    );

  const metadata = {};
  metadata.name = options.name;
  metadata.description = options.description;
  if (options.externalUrl) metadata.external_url = options.externalUrl;

  // if (!options.map) throw new Error("a map is required");
  const mapRootLabel = rootLabel(map);

  const vrf_inputs = map.vrf_inputs;

  // The map generation params contribute to the alpha but do not compromise
  // it if revealed. And they are a good indication of map characteristics.
  let params = vrf_inputs.alpha.split(":");
  params = Object.fromEntries(
    params[params.length - 1].split(",").map((params) => params.split("="))
  );
  const proofs = {
    beta: vrf_inputs.proof.beta,
    public_key: vrf_inputs.proof.public_key,
    map_root_label: mapRootLabel,
    map_root: trie.root,
  };
  metadata.properties = { ...params, proofs };

  if (options.trialSetupCodex)
    metadata.properties = {
      ...metadata.properties,
      trialsetup: blobcodexMetadataProperty(options.trialSetupCodex, {
        filename: trialSetupPropertyFilename,
      }),
    };

  return metadata;
}

// chaintrapGameDefaults provides the defaults for configureInitArgs
export const chaintrapGameDefaults = {
  choiceInputTypes: [ObjectType.LocationChoices],
  transitionTypes: [
    ObjectType.Link2,
    ObjectType.Finish,
    ObjectType.FatalChestTrap,
    ObjectType.ChestTreatGainLife,
  ],
  victoryTransitionTypes: [ObjectType.Finish],
  haltParticipantTransitionTypes: [ObjectType.FatalChestTrap],
  livesIncrement: [ObjectType.ChestTreatGainLife],
  livesDecrement: [ObjectType.FatalChestTrap],
};

/**
 * Returns the exact arguments required for arena createGame
 * @returns {[object,object]}
 */
export function prepareTrialInitArgs(properties, options) {
  if (!properties?.proofs?.map_root || !properties?.proofs?.map_root_label)
    throw new Error(
      `metadata.proofs.map_ properties not fully configured have: ${JSON.stringify(
        properties
      )}`
    );
  if (!options.tokenURI) throw new Error("options.tokenURI is required");

  if (!options.choiceInputTypes || options.choiceInputTypes.length == 0)
    throw new Error(
      `dungeon choice input types must be committed when the game is created`
    );

  const initArgs = {};
  initArgs.tokenURI = options.tokenURI;

  const transitionTypes = {};
  for (const ty of options?.transitionTypes ?? []) transitionTypes[ty] = true;
  if (Object.keys(transitionTypes).length < 2)
    throw new Error(
      `at least two transition types are required for a completable game`
    );
  if ((options.victoryTransitionTypes ?? []).length < 1)
    throw new Error(
      `at least one victory transition types is required for a completable game`
    );
  for (const ty of options.victoryTransitionTypes)
    if (!(ty in transitionTypes))
      throw new Error(
        `all victory transition types must also be listed in transitionTypes`
      );

  for (const ty of options.haltParticipantTransitionTypes ?? [])
    if (!(ty in transitionTypes))
      throw new Error(
        `all halting transition types must also be listed in transitionTypes`
      );

  // this.initArgs.registrationLimit = ethers.BigNumber.from(options.registrationLimit);
  initArgs.registrationLimit =
    options.registrationLimit ?? defaultMaxParticipants;
  initArgs.trialistArgs = {
    flags: 0,
    lives: options.initialLives ?? defaultParticipanInitialLives,
  };
  initArgs.rootLabels = [
    ethers.utils.formatBytes32String(properties.proofs.map_root_label),
  ];
  initArgs.roots = [properties.proofs.map_root];
  initArgs.choiceInputTypes = options.choiceInputTypes.map(conditionInput);
  initArgs.transitionTypes = options.transitionTypes.map(conditionInput);
  initArgs.victoryTransitionTypes =
    options.victoryTransitionTypes.map(conditionInput);
  initArgs.haltParticipantTransitionTypes = (
    options.haltParticipantTransitionTypes ?? []
  ).map(conditionInput);
  initArgs.livesIncrement = (options.livesIncrement ?? []).map(conditionInput);
  initArgs.livesDecrement = (options.livesDecrement ?? []).map(conditionInput);

  if (!Object.keys(initArgs).length) throw new Error("not configured");

  return [
    initArgs,
    {
      type: options.networkEIP1559 ? 2 : 0,
    },
  ];
}
