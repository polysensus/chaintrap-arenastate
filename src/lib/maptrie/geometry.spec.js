// @ts-check
import { describe, it, expect } from "vitest";

import { Geometry, LocationGeometry } from "./geometry.js";

describe("Maptrie geometry tests", function () {
  it("Should create location geometry", function () {
    const lg = new LocationGeometry(0, 1, 2, 3);
    expect(lg.l).to.equal(0);
    expect(lg.w).to.equal(1);
    expect(lg.x).to.equal(2);
    expect(lg.y).to.equal(3);
  });
  it("Should create geometry", function () {
    const g = new Geometry();
    g.extendJoins([
      {
        points: [
          [1, 2],
          [2, 3],
        ],
      },
    ]);
  });
});
