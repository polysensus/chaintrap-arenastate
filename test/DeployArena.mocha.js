import hre from "hardhat";
const { ethers } = hre;
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployArenaFixture } from "./support/deployarena.js";
import { arenaConnect } from "../src/lib/arenaabi.js";

describe("Deployment", function () {
  it("Should deploy arena without issue", async function () {
    const [proxyAddress, owner] = await loadFixture(deployArenaFixture);
    expect(proxyAddress).to.exist;
    expect(owner).to.exist;
  });

  it("Should create arena proxy interface", async function () {
    const [proxyAddress, owner] = await loadFixture(deployArenaFixture);
    expect(proxyAddress).to.exist;
    expect(owner).to.exist;
    const arena = arenaConnect(proxyAddress, owner);
    expect(arena).to.exist;
  });
});
