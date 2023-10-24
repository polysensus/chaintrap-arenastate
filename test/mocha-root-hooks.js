import * as dotenv from "dotenv";
import path from "path";

import { fileURLToPath } from "url";
import { isFile } from "../src/commands/fsutil.js";
import { readBinaryData } from "../src/commands/data.js";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployArenaFixture } from "./support/deployarena.js";
import { prepareTrialMetadata } from "../src/lib/erc1155metadata/metadataprepare.js";
import { prepareTrialInitArgs } from "../src/lib/erc1155metadata/metadataprepare.js";
import { chaintrapGameDefaults } from "../src/lib/erc1155metadata/metadataprepare.js";
import { rootLabel } from "../src/lib/maptrie/logical.js";

import {
  envConnect,
  hreConnect,
  HH_OWNER_ACCOUNT_INDEX,
  HH_GUARDIAN_ACCOUNT_INDEX,
  HH_USER1_ACCOUNT_INDEX,
  HH_USER2_ACCOUNT_INDEX,
} from "./support/connect.js";

import {
  have as haveOpenAI,
  get as getOpenAIOpts,
} from "../src/lib/envopts/openai.js";
import {
  have as haveNFTStorage,
  get as getNFTStorageOpts,
} from "../src/lib/envopts/nftstorage.js";
import {
  have as haveMaptool,
  get as getMaptoolOpts,
} from "../src/lib/envopts/maptool.js";

import { Minter } from "../src/lib/minter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const mochaHooks = {
  beforeAll() {
    /** Global environment configuration for integration tests.
     *
     * .env.example.integ is the example that should be followed to fill in the
     * necessary config for the integration tests.
     *
     * CI/CD is expected to generate a .env file based on secrets configured in the pipeline.
     *
     * For local development one should be made by hand. Note that not all of the
     * variables are necessary, tests which don't have the config they need will
     * detect that its missing and auto skip.
     */

    const dotenvFile = path.join(
      __dirname,
      "..",
      process.env.DOTENV_FILE ?? ".env.test"
    );
    if (isFile(dotenvFile)) {
      console.log(`mocha-root-hook.js# test env config found at ${dotenvFile}`);
      dotenv.config({ path: dotenvFile });
    } else {
      console.log(
        `mocha-root-hook.js# no test env config found, "${dotenvFile}" is not a file`
      );
      dotenv.config();
    }

    this.ethersPollingInterval =
      process.env.ARENASTATE_ETHERS_POLLING_INTERVAL ?? 500;

    if (haveOpenAI()) this.openaiOptions = getOpenAIOpts();
    if (haveNFTStorage()) this.nftstorageOptions = getNFTStorageOpts();
    if (haveMaptool()) this.maptoolOptions = getMaptoolOpts();
    console.log(JSON.stringify(this.nftstorageOptions, null, "  "));
  },

  async afterEach() {
    for (const provider of [
      this.ownerArena.provider,
      this.guardianArena.provider,
      this.user1Arena.provider,
      this.user2Arena.provider,
      this.arena.provider,
    ]) {
      if (!provider) continue;
      provider.removeAllListeners();
    }
  },

  async beforeEach() {
    if (typeof process.env.ARENASTATE_ARENA === "undefined") {
      const proxyAddress = (await loadFixture(deployArenaFixture))[0];
      this.ownerArena = await hreConnect(proxyAddress, {
        account: HH_OWNER_ACCOUNT_INDEX,
        pollingInterval: this.ethersPollingInterval,
      });
      this.guardianArena = await hreConnect(proxyAddress, {
        account: HH_GUARDIAN_ACCOUNT_INDEX,
        pollingInterval: this.ethersPollingInterval,
      });
      this.user1Arena = await hreConnect(proxyAddress, {
        account: HH_USER1_ACCOUNT_INDEX,
        pollingInterval: this.ethersPollingInterval,
      });
      this.user2Arena = await hreConnect(proxyAddress, {
        account: HH_USER2_ACCOUNT_INDEX,
        pollingInterval: this.ethersPollingInterval,
      });
      this.arena = await hreConnect(proxyAddress, {});
    } else {
      const proxyAddress = process.env.ARENASTATE_ARENA;
      this.ownerArena = envConnect(proxyAddress, {
        key: process.env.ARENASTATE_OWNER_KEY,
        pollingInterval: this.ethersPollingInterval,
      });
      this.guardianArena = envConnect(proxyAddress, {
        key: process.env.ARENASTATE_GUARDIAN_KEY,
        pollingInterval: this.ethersPollingInterval,
      });
      this.user1Arena = envConnect(proxyAddress, {
        key: process.env.ARENASTATE_USER1_KEY,
        pollingInterval: this.ethersPollingInterval,
      });
      this.user2Arena = envConnect(proxyAddress, {
        key: process.env.ARENASTATE_USER2_KEY,
        pollingInterval: this.ethersPollingInterval,
      });

      // provider only instance, no signer
      this.arena = envConnect(proxyAddress, {});
    }
    if (!this.openaiOptions || !this.nftstorageOptions || !this.maptoolOptions)
      return;
    this.gameOptions = {
      name: "a test game", 
      description: "a test game",
      ...this.openaiOptions.options,
      ...this.nftstorageOptions.options,
      ...this.maptoolOptions.options,
    };

    this.mapDataForRootLabel = {vrf_inputs: {alpha: "aaa=111:bbb=222:ccc=333", proof: {beta: 'beta', public_key: 'public_key'}}}
    this.mapRootLabel = rootLabel(this.mapDataForRootLabel);


    this.gameIconBytes = readBinaryData("gameicons/game-ico-1.png");

    // note all of this is because fixture functions require a name, they can't be anonymous
    this.mintGame = async function(options) {
      options = {...this.gameOptions, noMetadataPublish: true, gameIconBytes:this.gameIconBytes, ...options}
      const metadata = prepareTrialMetadata(
        this.mapDataForRootLabel, options.trie, {name:options.name, description:options.description}
        );
      const args = prepareTrialInitArgs(metadata.properties, {
        ...chaintrapGameDefaults, registrationLimit: options.maxParticipants ?? 5, tokenURI:'the-token-uri',
        networkEIP1559: options?.networkEIP1559
      });

      this.gameInitArgs = args[0];

      const tx = await this.guardianArena.createGame(...args);
      const r = await tx.wait();
      if (r?.status !== 1) throw new Error("createGame failed");
      return r;
    }
    console.log("beforeEach done");
  },
};
