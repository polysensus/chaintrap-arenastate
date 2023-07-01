// @ts-check
import { expect } from "chai";
import { ethers } from "ethers";
const arrayify = ethers.utils.arrayify;
const hexlify = ethers.utils.hexlify;

import * as msgpack from "@msgpack/msgpack";
import { Guardian } from "./guardian.js";

//
import maps from "../../data/maps/map02.json" assert { type: "json" };

describe("Trial createResolveOutcomeArgs tests", function () {
  it("Should resolve a location exit choice", async function () {
    if (!this.gameOptions) {
      this.skip();
    }
    const guardian = new Guardian(this.guardianArena, this.gameOptions);
    guardian.prepareDungeon(maps, { mapName: "map02" });
    guardian.finalizeDungeon();
    await guardian.mintGame();
  });
});
