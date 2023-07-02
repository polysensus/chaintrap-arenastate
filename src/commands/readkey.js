import { isFile, readHexKey } from "./fsutil.js";
import { resolveHardhatKey } from "../lib/chainkit/hhkeys.js";

export function readKey(key) {
  if (!key) return;

  if (isFile(key)) {
    key = readHexKey(key);
  }
  if (key.constructor?.name === "String") {
    key = resolveHardhatKey(key);
  }
  return key;
}
