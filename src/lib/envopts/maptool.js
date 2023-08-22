import { haveAllNames } from "./have.js";
import { getAllNames } from "./get.js";

export const REQUIRED = ["URL", "IMAGE", "IMAGE_DIGEST"];
export const ALL = [...REQUIRED];

/**
 * returns true if all the non optional maptool vars are available in the env.
 * @returns {boolean}
 */
export function have(options) {
  return haveAllNames(REQUIRED, { prefix: "ARENASTATE_MAPTOOL_", ...options });
}

export function get(options) {
  return getAllNames(ALL, {
    prefix: "ARENASTATE_MAPTOOL_",
    group: "maptool",
    ...options,
  });
}
