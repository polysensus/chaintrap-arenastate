// @ts-check
import { expect } from "chai";

import { Furniture } from "./furniture.js";
import furnishings from "../../../data/maps/map02-furnishings.json" assert { type: "json" };

describe("Furniture tests", function () {
  it("Should load furnishings data", async function () {
    const f = new Furniture(furnishings);
    expect(f.items.length).to.equal(1);
  });
});
