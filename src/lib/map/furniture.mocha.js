// @ts-check
import { expect } from "chai";

import { Furniture } from "./furniture.js";
import { ObjectType } from "../maptrie/objecttypes.js";
import furnishings from "../../../data/maps/map02-furnishings.json" assert { type: "json" };

describe("Furniture tests", function () {
  it("Should load furnishings data", async function () {
    const f = new Furniture(furnishings);
    expect(f.items.length).to.equal(3);
    expect(f.index?.identified["finish_exit"]).to.exist;
    expect(f.index?.identified["chest_1"]).to.exist;
    expect(f.byName("finish_exit")).to.not.throw;
    expect(f.byName("chest_1")).to.not.throw;
    expect(f.byType(ObjectType.FinishExit).length).to.equal(1);
    expect(f.byType(ObjectType.FatalChestTrap).length).to.equal(1);
    expect(f.byTypeName("finish_exit")).to.not.throw;
    expect(f.byTypeName("fatal_chest_trap")).to.not.throw;
  });
});
