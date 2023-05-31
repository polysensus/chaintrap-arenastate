import hre from "hardhat";
const ethers = hre.ethers;
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Access } from "../../src/lib/maptrie/access.js";
import { ObjectCodec, LeafObject } from "../../src/lib/maptrie/objects.js";

import { deployArenaFixture } from "../support/deployarena.js";
import { topologyForMap02 } from "../support/maptrie.js";
import {
  arenaConnect,
  errorABISelectors,
  customError,
} from "../../src/lib/chaintrapabi.js";

let customErrors;

function wrapCustomError(err) {
  if (!customErrors) customErrors = errorABISelectors();
  return customError(customErrors, err);
}

async function expectReceipt(transactor, ...args) {
  let tx, r;
  try {
    tx = await transactor(...args);
  } catch (err) {
    throw wrapCustomError(err);
  }

  try {
    r = await tx.wait();
  } catch (err) {
    throw wrapCustomError(err);
  }

  expect(r.status).to.equal(1);
  return { tx, r };
}

describe("LibTranscript_createGame2", async function () {
  let proxy;
  let ownerSigner;
  let errors;

  before(function () {
    errors = errorABISelectors();
  });

  it("Should create a new game2", async function () {
    // Need a fresh proxy to get the gids we expect
    [proxy, ownerSigner] = await loadFixture(deployArenaFixture);

    const arena = arenaConnect(proxy, ownerSigner);

    let { r } = await expectReceipt(arena.createGame, {
      tokenURI: "",
      rootLabels: [ethers.utils.formatBytes32String("a-root-label")],
      roots: [
        "0x141d529a677497c1e718dcaea00c5ee952720942c8a43e9fda2c38ab24cfb562",
      ],
    });
    expect(r.events?.[0]?.args?.id?.and(1)).to.equal(ethers.BigNumber.from(1));
  });

  it("Should register player on game with real map", async function () {
    // Need a fresh proxy to get the gids we expect
    [proxy, ownerSigner] = await loadFixture(deployArenaFixture);

    const owner = arenaConnect(proxy, ownerSigner);

    const playerSigner = (await hre.ethers.getSigners())[10];
    const player = arenaConnect(proxy, playerSigner);

    const topo = topologyForMap02();
    const trie = topo.encodeTrie();

    let { r } = await expectReceipt(owner.createGame, {
      tokenURI: "",
      rootLabels: [ethers.utils.formatBytes32String("a-root-label")],
      roots: [trie.root],
    });
    const gid = r.events?.[0]?.args?.id;

    await expectReceipt(
      player.register,
      gid,
      ethers.utils.toUtf8Bytes("player1")
    );

    await expectReceipt(owner.startTranscript, gid);

    // location 2 has sides: [[2], [], [3], [10]]
    const START = 2; // start at 2
    const NORTH = 0;

    const egress = new Access({ location: START, side: NORTH, exit: 0 });
    const link = topo.linkedAccess(egress);
    const leaf = ObjectCodec.prepare(LeafObject.linkLeaf(link));
    const node = trie.leafHash(leaf);
    const i = trie.hashLookup[node];
    const proof = trie.getProof(i);

    r = (
      await expectReceipt(player.transcriptEntryCommit, gid, {
        rootLabel: ethers.utils.formatBytes32String("a-root-label"),
        node,
        data: "0xdada",
      })
    ).r;
    expect(r.events.length).to.be.greaterThan(0);

    const participant = await playerSigner.getAddress();
    r = await expectReceipt(owner.transcriptEntryResolve, gid, {
      participant,
      outcome: 3, // Accepted
      data: "0xdbdb",
      proof,
      node,
    });
  });
});
