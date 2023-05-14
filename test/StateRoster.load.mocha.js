import hre from "hardhat";
const ethers = hre.ethers;
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("StateRoster# load tests", async function() {

  before(async function() {
    if (!this.gameOptions || !this.mintFixture) {
      this.skip();
    }
  });

  it("Should load a game", async function() {
    const r = await loadFixture(this.mintFixture);
    expect(r.status).to.equal(1);
  });
  it("Should load another game", async function() {
    const r = await loadFixture(this.mintFixture);
    expect(r.status).to.equal(1);
  });
});
