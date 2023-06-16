// @ts-check
import { expect } from "chai";
import { ExitMenu } from "./exitmenu.js";

describe("SceneExitChoice tests", function () {
  it("Should encode inputs", function () {
    const sceneMenu = new ExitMenu([0, 2, 3, 0]);
    const inputs = sceneMenu.inputs();

    expect(inputs.length).to.equal(5);

    // side 1
    expect(inputs[0][0]).to.equal(1);
    expect(inputs[0][1]).to.equal(0);
    expect(inputs[1][0]).to.equal(1);
    expect(inputs[1][1]).to.equal(1);

    // side 2
    expect(inputs[2][0]).to.equal(2);
    expect(inputs[2][1]).to.equal(0);
    expect(inputs[3][0]).to.equal(2);
    expect(inputs[3][1]).to.equal(1);
    expect(inputs[4][0]).to.equal(2);
    expect(inputs[4][1]).to.equal(2);
  });

  it("Should round trip inputs", function () {
    const sceneMenu = new ExitMenu([0, 2, 3, 0]);
    const prepared = sceneMenu.prepare();
    const hydrated = ExitMenu.hydrate(prepared);
    const inputs = hydrated.inputs();

    // side 1
    expect(inputs[0][0]).to.equal(1);
    expect(inputs[0][1]).to.equal(0);
    expect(inputs[1][0]).to.equal(1);
    expect(inputs[1][1]).to.equal(1);

    // side 2
    expect(inputs[2][0]).to.equal(2);
    expect(inputs[2][1]).to.equal(0);
    expect(inputs[3][0]).to.equal(2);
    expect(inputs[3][1]).to.equal(1);
    expect(inputs[4][0]).to.equal(2);
    expect(inputs[4][1]).to.equal(2);
  });
});
