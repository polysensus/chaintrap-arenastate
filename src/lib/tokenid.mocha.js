import { expect } from "chai";
import { ethers } from "ethers";

import { gameInstance } from "./tokenid.js";

export const gameType = ethers.BigNumber.from(
  // 4 << 128
  [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
);

describe("tokenid tests", function () {
  it("Should be 1", async function () {
    const gid = ethers.BigNumber.from("0x0400000000000000000000000000000012");
    const tyHex = gameType.toHexString();
    const i = gameInstance(gid);
    expect(i).to.equal(18); // its hex above
  });
});
