// @ts-check
import { expect } from "chai";

import { NameCodes, CodeNames } from "./namecodes.js";

describe("transcriptevents.namecodes", function () {
  it("Should read the correct numbers", function () {
    expect(NameCodes.TranscriptCreated).to.equal(1);
    expect(CodeNames[1]).to.equal("TranscriptCreated");
  });
});
