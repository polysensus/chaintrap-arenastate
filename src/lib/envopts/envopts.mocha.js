// @ts-check
import { expect } from "chai";

import { have as haveNFTStorage, get as getNFTStorage } from "./nftstorage.js";
import { have as haveOpenai, get as getOpenai } from "./openai.js";

describe("envopts tests", function () {
  it("Should allow an empty prefix for have nftstorage opts", function () {
    expect(haveNFTStorage({ env: { URL: "url", API_KEY: "key" }, prefix: "" }))
      .to.be.true;
  });

  it("Should allow a custom prefix for have nftstorage opts", function () {
    const env = {
      URL: "url",
      API_KEY: "key",
    };
    expect(
      haveNFTStorage({
        env: { PUBLIC_URL: "url", PUBLIC_API_KEY: "key" },
        prefix: "PUBLIC_",
      })
    ).to.be.true;
  });
  it("Should get nftstorage opts even if required are missing", function () {
    const got = getOpenai({
      env: { IMAGES_URL: "url", API_KEY: "key" },
      prefix: "",
    });
    expect(got.options?.openaiImagesUrl).to.equal("url");
    expect(got.options?.openaiApiKey).to.equal("key");
  });
});
