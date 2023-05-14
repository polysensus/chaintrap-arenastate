import {haveAllNames} from "./have.js";
import {getAllNames} from "./get.js";

export const REQUIRED = [ "URL", "IMAGE", "IMAGE_DIGEST" ];
export const ALL = [...REQUIRED]

/**
 * returns true if all the non optional maptool vars are available in the env.
 * @returns {boolean}
 */
export function have() {
  return haveAllNames(REQUIRED, {prefix:"ARENASTATE_MAPTOOL_"});
}

export function get() {
  return getAllNames(ALL, {prefix:"ARENASTATE_MAPTOOL_", group:"maptool"});
}