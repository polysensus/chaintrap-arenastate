import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function dataPath(dataFile) {
  return path.join(__dirname, "..", "..", "data/", dataFile);
}

export function readBinaryData(dataFile) {
  return fs.readFileSync(dataPath(dataFile), null);
}

export function readJsonData(dataFile) {
  return JSON.parse(fs.readFileSync(dataPath(dataFile), "utf-8"));
}
