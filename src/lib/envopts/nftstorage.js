import {haveAllNames} from "./have.js";
import {getAllNames} from "./get.js";

export const REQUIRED = [ "URL", "API_KEY" ];
export const ALL = [...REQUIRED, "GAME_ICON_FILENAME"];

/**
 * returns true if all the non optional maptool vars are available in the env.
 * @returns {boolean}
 */
export function have() {
  return haveAllNames(REQUIRED, {prefix:"ARENASTATE_NFTSTORAGE_"});
}

export function get() {
  return getAllNames(ALL, {prefix:"ARENASTATE_NFTSTORAGE_", group: "nftstorage"});
}