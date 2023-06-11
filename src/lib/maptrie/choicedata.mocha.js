// @ts-check
import { expect } from "chai";

import { ethers } from "ethers";

describe("ChoiceData tests", function () {
  it("Should encode bytes16 dynamic array", function () {
    // const array = ethers.utils.arrayify("0x0001000200030004");
    const encoder = ethers.utils.defaultAbiCoder;
    const encoded = encoder.encode(
      // ['bytes2[]'], [array]
      ["bytes2[]"],
      [["0x0001", "0x0002", "0x0003", "0x0004"]]
    );
    console.log(encoded.length / 2);
    console.log(typeof encoded);

    const packed = ethers.utils.solidityPack(
      // ['bytes2[]'], [array]
      ["bytes2[]"],
      [["0x0001", "0x0002", "0x0003", "0x0004"]]
    );
    console.log(packed.length / 2);
    console.log(typeof encoded);
  });

  it("Should build merkle for standard test map map", function () {
    const encoder = ethers.utils.defaultAbiCoder;
    const encoded = encoder.encode(
      ["bytes2[][]"],
      [
        [
          [
            "0x0102",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
          ],
          ["0x0506", "0x0708", "0x090a", "0x090a", "0x090a"],
        ],
      ]
    );
    // ['0x0506', '0x0708', '0x090a']]

    const packed = ethers.utils.solidityPack(
      ["bytes2[][]"],
      [
        [
          [
            "0x0102",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
            "0x0304",
          ],
          ["0x0506", "0x0708", "0x090a", "0x090a", "0x090a"],
        ],
      ]
    );

    console.log(encoded.length / 2);
    console.log(typeof encoded);
    console.log(packed.length / 2);
    console.log(typeof packed);
  });
});
