/**
 * return true if all entries in names are in the env and are not empty, undefined or false
 * @param {[]string} names
 * @param {string} prefix
 * @returns
 */
export function haveAllNames(names, options) {
  const prefix = options?.prefix ?? "ARENASTATE_";

  for (const name of names) {
    const value = process.env[`${prefix}${name}`];
    if (typeof value === "undefined") return false;
    if (value.constructor.name === "String" && value === "") return false;
    if (!value && value !== 0) return false;
  }
  return true;
}
