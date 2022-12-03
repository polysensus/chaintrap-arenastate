import { expect, describe, it } from "vitest";

// deps

// app
import { TxMemo } from "./txmemo.js";

export class X {
  constructor(y = 10) {
    this._recentTx = y;
  }
}

describe("Txmemo", function () {
  it("Should create empty memo", async function () {
    const r = new TxMemo();
    expect(r._recentTx).toBeDefined();
  });
});
