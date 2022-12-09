import { describe, it, expect } from "vitest";
import { ethers } from "ethers";

const keccack = ethers.utils.keccak256;

import { Scene } from "./scene.js";

const arrayify = ethers.utils.arrayify;
// const abiCoder = new ethers.utils.AbiCoder();

describe("Scene", function () {
  it("Should round trip encdec blob", function () {
    const scene = { one: 1, listy: [1, 2, ""] };
    // const hexToken = "0x00112233445566778899aabbccddeeff112233445566778899aabbccddeeff00"

    const token = keccack("0x1234");
    const sbe = Scene.encodeblob(token, scene);
    const [tokend, sbd] = Scene.decodeblob(sbe);
    expect(tokend).toEqual(token);
    expect(sbd.one).toEqual(scene.one);
    expect(sbd.listy[0]).toEqual(scene.listy[0]);
    expect(sbd.listy[1]).toEqual(scene.listy[1]);
    expect(sbd.listy[2]).toEqual(scene.listy[2]);
  });
});
