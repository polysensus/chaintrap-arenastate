import * as dotenv from "dotenv";
import path from "path";

import { fileURLToPath } from "url";
import { isFile } from "../src/commands/fsutil.js";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployArenaFixture } from "./support/deployarena.js";
import {
  envConnect,
  HH_OWNER_ACCOUNT_INDEX,
  HH_GUARDIAN_ACCOUNT_INDEX,
  HH_USER1_ACCOUNT_INDEX,
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

import { Minter } from "./support/minter.js";

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
      console.log(`mocha-root-hook.js# test env config not found at ${dotenvFile}`);
      dotenv.config({ path: dotenvFile });
    } else
      dotenv.config();

    if (haveOpenAI()) this.openaiOptions = getOpenAIOpts();
    if (haveNFTStorage()) this.nftstorageOptions = getNFTStorageOpts();
    if (haveMaptool()) this.maptoolOptions = getMaptoolOpts();
  },

  async beforeEach() {
    if (typeof process.env.ARENASTATE_ARENA === "undefined") {
      this.proxyAddress = (await loadFixture(deployArenaFixture))[0];
      this.ownerArena = hreConnect(proxyAddress, {
        account: HH_OWNER_ACCOUNT_INDEX,
      });
      this.guardianArena = hreConnect(proxyAddress, {
        account: HH_GUARDIAN_ACCOUNT_INDEX,
      });
      this.user1Arena = hreConnect(proxyAddress, {
        account: HH_USER1_ACCOUNT_INDEX,
      });
    } else {
      const proxyAddress = process.env.ARENASTATE_ARENA;
      this.ownerArena = envConnect(proxyAddress, {
        key: process.env.ARENASTATE_OWNER_KEY,
      });
      this.guardianArena = envConnect(proxyAddress, {
        key: process.env.ARENASTATE_GUARDIAN_KEY,
      });
      this.user1Arena = envConnect(proxyAddress, {
        key: process.env.ARENASTATE_USER1_KEY,
      });
      this.user2Arena = envConnect(proxyAddress, {
        key: process.env.ARENASTATE_USER2_KEY,
      });

      // provider only instance, no signer
      this.arena = envConnect(proxyAddress, {});
    }
    if (!this.openaiOptions || !this.nftstorageOptions || !this.maptoolOptions)
      return;
    this.gameOptions = {
      ...this.openaiOptions.options,
      ...this.nftstorageOptions.options,
      ...this.maptoolOptions.options,
    };
    this.minter = new Minter(
      this.guardianArena,
      this.gameOptions
    );
    // note all of this is because fixture functions require a name, they can't be anonymous
    this.mintGame = this.minter.mint.bind(this.minter);
  },
};
