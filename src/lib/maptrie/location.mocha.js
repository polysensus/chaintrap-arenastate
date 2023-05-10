// @ts-check
import { expect } from "chai";

import { Join } from "./join.js";
import { Location } from "./location.js";
import { namedFlags } from "./namedflags.js";

describe("Maptrie Location tests", function () {
  it("Should deal with up to 255 flags", function () {
    const names = ["first", "second"];
    for (let i = 2; i < 255; i++) {
      names.push(`flag${i}`);
    }
    const flags = { second: true, flag254: true };

    const bytes = namedFlags(names, flags);
    expect(bytes[bytes.length - 1]).to.equal(1 << 1);
    expect(bytes[0]).to.equal(1 << 6);
  });

  it("Should create join", function () {
    const j = new Join([0, 1], [2, 3], {});
    expect(j.joins[0]).to.equal(0);
    expect(j.joins[1]).to.equal(1);
    expect(j.sides[0]).to.equal(2);
    expect(j.sides[1]).to.equal(3);
  });

  it("Should create location", function () {
    const j = new Location([[0], [1, 2], [3], []], {});
    expect(j.sides[0][0]).to.equal(0);
    expect(j.sides[0].length).to.equal(1);

    expect(j.sides[1][0]).to.equal(1);
    expect(j.sides[1][1]).to.equal(2);
    expect(j.sides[1].length).to.equal(2);

    expect(j.sides[2][0]).to.equal(3);
    expect(j.sides[2].length).to.equal(1);
    expect(j.sides[3].length).to.equal(0);
  });
});
