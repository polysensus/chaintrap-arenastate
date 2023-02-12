import fs from "fs";

import { BaseReader } from "../finder.js";

export class FileReader extends BaseReader {
  readJson(foundname) {
    return JSON.parse(fs.readFileSync(foundname, "utf-8"));
  }
  readAbi(foundname) {
    return this.readJson(foundname);
  }
}
