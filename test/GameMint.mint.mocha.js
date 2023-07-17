import hre from "hardhat";
const ethers = hre.ethers;
import { expect } from "chai";
import fetch from "node-fetch";

import { readBinaryData } from "./support/data.js";

import { LogicalTopology } from "../src/lib/maptrie/logical.js";
import { GameMetadataCreator } from "../src/lib/erc1155metadata/gamecreator.js";
import { ObjectType } from "../src/lib/maptrie/objecttypes.js";

import collection from "../data/maps/map02.json" assert { type: "json" };
import furnishings from "../data/maps/map02-furnishings.json" assert { type: "json" };

import { Furniture } from "../src/lib/map/furniture.js";

// Note: see test/hook.js to see how the various this.xxxArena's are configured

describe("GameMint.mint tests", async function () {
  it("Should mint a game", async function () {
    if (
      !this.openaiOptions ||
      !this.nftstorageOptions ||
      !this.maptoolOptions
    ) {
      this.skip();
    }
    this.mdOptions = {
      ...this.openaiOptions.options,
      ...this.nftstorageOptions.options,
      ...this.maptoolOptions.options,
    };

    const arena = this.guardianArena;
    const iface = arena.getFacetInterface("ERC1155ArenaFacet");

    const topo = LogicalTopology.fromMapJSON(collection["map02"]);
    const furniture = new Furniture(furnishings);
    topo.placeFinish(furniture.byName("finish_exit"));
    const trie = topo.commit();

    const minter = new GameMetadataCreator();
    const mdOptions = {
      ...this.mdOptions,
      fetch,
      gameIconBytes: readBinaryData("gameicons/game-ico-1.png"),
      name: "test# should mint a game",
      description: "test# should mint a game description",
    };
    const mapRootLabel = "chaintrap-dungeon:static";
    minter.configureMetadataOptions(mdOptions);
    minter.configureNFTStorageOptions(mdOptions);
    minter.configureGameIconOptions(mdOptions);
    minter.configureMaptoolOptions(mdOptions);
    minter.configureMapOptions({
      map: collection["map02"],
      mapRootLabel,
      topology: topo,
      trie,
      choiceInputTypes: [ObjectType.LocationChoices],
      transitionTypes: [ObjectType.Link2, ObjectType.Finish],
      victoryTransitionTypes: [ObjectType.Finish],
    });
    await minter.prepareGameImage();
    const metadataUrl = await minter.publishMetadata();
    expect(metadataUrl).to.exist;
    const r = await minter.mint(arena);
    expect(r.transactionHash).to.exist;
    const o = {
      roots: {},
    };
    for (const log of r.logs) {
      try {
        const parsed = iface.parseLog(log);
        switch (parsed.name) {
          case "TransferSingle":
            o.id = parsed.args.id;
            o.idHex = o.id.toHexString();
            o.creator = parsed.args.to;
            break;
          case "URI":
            o.uri = parsed.args.value;
            break;
          case "TranscriptMerkleRootSet":
            o.roots[ethers.utils.parseBytes32String(parsed.args.label)] =
              ethers.utils.hexlify(parsed.args.root);
            break;
          case "TranscriptCreated":
            o.registrationLimit = parsed.args.registrationLimit.toNumber();
            break;
        }
      } catch (err) {
        out(`${err}`);
      }
    }
    expect(o.id).to.exist;
    expect(o.creator).to.exist;
    expect(o.uri).to.exist;
    expect(o.registrationLimit).to.be.greaterThan(0);
    expect(o.roots[mapRootLabel]).to.be.equal(trie.root);
  });
});
