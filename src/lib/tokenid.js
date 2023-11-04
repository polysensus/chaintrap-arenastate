// utilities for working with the token id's
import { ethers } from "ethers";

const GAME2_TYPE = 4;

export const gameType = ethers.BigNumber.from(
  // GAME2_TYPE << 128
  [GAME2_TYPE, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
);

/**
 * gameInstance returns the instance number from a game (trial) token
 */
export function gameInstance(gid) {
  return gid.sub(gameType).toNumber();
}

/**
 *
 * @param {number} instance
 */
export function gameToken(instance) {
  return gameType.add(instance);
}
