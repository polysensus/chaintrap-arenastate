import {haveAllNames} from "./have.js";
import {getAllNames} from "./get.js";

export const REQUIRED=[ "API_KEY" , "IMAGES_URL" ];

export const ALL=[ ...REQUIRED, "IMAGE_PROMPT" ];

/**
 * returns true if all the non optional openai vars are available in the env.
 * @returns {boolean}
 */
export function have() {
  return haveAllNames(REQUIRED, {prefix:"ARENASTATE_OPENAI_"});
}

export function get() {
  return getAllNames(ALL, {prefix:"ARENASTATE_OPENAI_", group:"openai"});
}