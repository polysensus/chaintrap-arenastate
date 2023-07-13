import { expect } from "chai";
import { GameMetadataReader } from "./gamereader.js";
import { nftstorageIPFSGatewayURL } from "../chainkit/nftstorage.js";

const metadataURL =
  "ipfs://bafyreiad2oxdirkzgxi53we26ne3a7kzuawjl77n64xr7vaf4imqdqouw4/metadata.json";

describe("GameMetadataReader tests", function () {
  it("Should read urls explicitly", async function () {
    this.skip(); // this test is for local testing only, though ipfs urls *could* be fetched from ci/cd we do not at present.
    const reader = new GameMetadataReader({
      fetch,
      ipfsGatewayUrl: nftstorageIPFSGatewayURL,
    });
    const data = await reader.fetchJson(metadataURL);
    const trialSetupJson = await reader.fetchJson(
      data.properties.trialsetup.ipfs
    );
    console.log(trialSetupJson);
  });

  it("Should read trialSetup json data", async function () {
    this.skip(); // this test is for local testing only, though ipfs urls *could* be fetched from ci/cd we do not at present.
    const reader = new GameMetadataReader({
      fetch,
      ipfsGatewayUrl: nftstorageIPFSGatewayURL,
    });
    const data = await reader.fetchTrialSetupJson(metadataURL);
    console.log(data);
  });

  it("Should read trialSetup codex", async function () {
    this.skip(); // this test is for local testing only, though ipfs urls *could* be fetched from ci/cd we do not at present.
    const reader = new GameMetadataReader({
      fetch,
      ipfsGatewayUrl: nftstorageIPFSGatewayURL,
    });
    const codex = await reader.fetchTrialSetupCodex(metadataURL, "very-secret");
    const map = codex.objectFromData(codex.getIndexedItem("map", { ikey: 0 }));
    console.log(map);
  });

  it("Should read trialSetup items", async function () {
    this.skip(); // this test is for local testing only, though ipfs urls *could* be fetched from ci/cd we do not at present.
    const reader = new GameMetadataReader({
      fetch,
      ipfsGatewayUrl: nftstorageIPFSGatewayURL,
    });
    const setup = await reader.fetchTrialSetup(metadataURL, "very-secret");
    expect(setup.map).to.exist;
    expect(setup.furniture).to.exist;
    expect(setup.committed).to.exist;
    expect(setup.svg).to.exist;
  });
});
