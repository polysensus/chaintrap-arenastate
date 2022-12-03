import fs from "fs/promises";
import { ethers } from "ethers";

export async function isFile(maybe) {
  try {
    const stats = await fs.stat(maybe);
    return stats.isFile();
  } catch (err) {
    console.log(err);
    return false;
  }
}

export async function readHexKey(key) {
  key = await fs.readFile(key, "utf-8");
  key = key.trim(); // deals with trailing newline
  if (!key.startsWith("0x")) {
    key = "0x" + key;
  }
  return new ethers.utils.SigningKey(key);
}

export async function readJson(filename) {
  return JSON.parse(await fs.readFile(filename, "utf-8"));
}
