import hre from 'hardhat';
const { ethers } = hre;
// const fs = require("fs");
// const dd = require("@polysensus/diamond-deploy");
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployArenaFixture } from './lib/deployarena.js';

// const {
//   time,
//   loadFixture,
// } = require("@nomicfoundation/hardhat-network-helpers");

// import { deriveContractAddress } from "@polysensus/diamond-deploy";
// import { arenaConnect } from 'chaintrapabi.js';
// import { resolveHardhatKey } from ".hhkeys.js";

describe("Dispatcher", function () {
  it("Should work", async function () {

    const [arena, owner] = await loadFixture(deployArenaFixture);
    console.log(JSON.stringify(owner))
  })
})