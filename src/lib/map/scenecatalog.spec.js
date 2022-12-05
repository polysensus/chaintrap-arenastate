import fs from "fs";
import path from "path";

import { describe, it, expect } from "vitest";

import { SceneCatalog } from "./scenecatalog.js";

const maps = JSON.parse(
  fs.readFileSync(path.join(__dirname, "mocks/map01-model-two-rooms.json"))
);

const { map01, map01badroomcorridor } = maps;

describe("SceneCatalog", function () {
  it("Should create an empty catalog", async function () {
    const scat = new SceneCatalog();
  });
  it("Should load two rooms", async function () {
    const scat = new SceneCatalog();
    scat.load(map01);
  });
  it("Should raise exception loading two rooms", async function () {
    const scat = new SceneCatalog();
    expect(() => {
      scat.load(map01badroomcorridor);
    }).toThrow("issues with room 1: [[0,0]]");
  });
});
