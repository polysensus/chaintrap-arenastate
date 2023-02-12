import fs from "fs";

import { BaseReader } from "../finder.js";

export class FileReader extends BaseReader {
  readAbi(foundname) {
    return JSON.parse(fs.readFileSync(foundname, "utf-8"));
  }
}
