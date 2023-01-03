import fs from "fs";
import { ethers } from "ethers";

export function isFile(maybe) {
  try {
    const stats = fs.statSync(maybe);
    return stats.isFile();
  } catch (err) {
    console.log(err);
    return false;
  }
}

export function readHexKey(key) {
  key = fs.readFileSync(key, "utf-8");
  key = key.trim(); // deals with trailing newline
  if (!key.startsWith("0x")) {
    key = "0x" + key;
  }
  return new ethers.utils.SigningKey(key);
}

export function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf-8"));
}

export function readBinary(filename) {
  return fs.readFileSync(filename, null);
}

export function writeBinary(filename, data) {
  return fs.writeFileSync(filename, Buffer.from(data), { encoding: "binary" });
}

export function writeText(filename, data) {
  return fs.writeFileSync(filename, data, { encoding: "utf-8" });
}
