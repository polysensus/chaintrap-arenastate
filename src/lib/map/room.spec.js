import { expect, describe, it } from "vitest";

import { targetRoomIngress } from "./rooms.js";

const model_2rooms_northsouth = {
  corridors: [
    {
      join_sides: [0, 2],
      joins: [0, 1]
    }
  ],
  rooms: [
    {
      corridors: [[0], [], [], []]
    },
    {
      corridors: [[], [], [0], []]
    }
  ]
}

describe("rooms", function () {
  it("Should reach south from north", function (){

    const [ir, ingressSide, ingressExit] = targetRoomIngress(
      model_2rooms_northsouth,
      0, 0, 0 // room, egressSide, egressIndex
    )
    expect(ir, "reached wrong room").toEqual(1);
    expect(ingressSide, "entered on wrong side").toEqual(2);
    expect(ingressExit, "entered wrong exit").toEqual(0);
  });
});