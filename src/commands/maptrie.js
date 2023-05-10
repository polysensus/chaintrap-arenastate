import { ethers } from "ethers";
const keccak256 = ethers.utils.keccak256;
const arrayify = ethers.utils.arrayify;
const hexlify = ethers.utils.hexlify;

import { readJson, writeJson } from "./fsutil.js";

import { LogicalTopology } from "../lib/maptrie/logical.js";
import { Link } from "../lib/maptrie/link.js";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

const log = console.log;
const out = console.log;

export function addMaptrie(program) {
  program
    .command("maptrie <mapfile>")
    .description(
      "build and serialize an openzeppelin merkle trie from a chaintrap map file"
    )
    .option("-o, --output <filename>", "output to file instead of standard out")
    .action((mapfile, options) => maptrie(program, options, mapfile));
}

export function addMaptrieProof(program) {
  program
    .command("maptrieproof <mapfile> <which>")
    .description(
      "build an openzeppelin merkle trie proof from a chaintrap map file. which is the proof index. this tool is intended for generating test vectors hence no consideration to how to figure out"
    )
    .action((mapfile, which, options) =>
      maptrieproof(program, options, mapfile, which)
    );
}

function dumpTrie(options, trie) {
  const data = trie.dump();

  if (options?.output) {
    writeJson(options.output, data);
    return;
  }
  out(JSON.stringify(data, null, "  "));
}

function maptrie(program, options, mapfile) {
  const maps = readJson(mapfile);
  if (Object.keys(maps).length !== 1) {
    out(`only single entry mapfiles are supported`);
    process.exit(1);
  }

  const model = Object.values(maps)[0]?.model;
  if (!model) {
    out(`model not found in map file`);
    process.exit(1);
  }

  const topo = new LogicalTopology();
  topo.extendJoins(model.corridors); // rooms 0,1 sides EAST, WEST
  topo.extendLocations(model.rooms);

  const trie = StandardMerkleTree.of([...topo.links()], Link.ABI);
  dumpTrie(options, trie);
}

function maptrieproof(program, options, mapfile, which) {
  const maps = readJson(mapfile);
  if (Object.keys(maps).length !== 1) {
    out(`only single entry mapfiles are supported`);
    process.exit(1);
  }

  const model = Object.values(maps)[0]?.model;
  if (!model) {
    out(`model not found in map file`);
    process.exit(1);
  }

  const topo = new LogicalTopology();
  topo.extendJoins(model.corridors); // rooms 0,1 sides EAST, WEST
  topo.extendLocations(model.rooms);

  const trie = StandardMerkleTree.of([...topo.links()], Link.ABI);

  for (const [i, v] of trie.entries()) {
    if (i !== Number(which)) continue;

    const leaf = keccak256(
      keccak256(arrayify(ethers.utils.defaultAbiCoder.encode(Link.ABI, v)))
    );

    const actualHash = hexlify(trie.getLeafHash(v));
    if (leaf !== actualHash)
      throw new Error(`broken leaf calculation: ${leaf} vs ${actualHash}`);

    if (!StandardMerkleTree.verify(trie.root, Link.ABI, v, trie.getProof(i)))
      throw new Error(`VerifyFailed`);
    // const impliedRoot = processProof(leaf, proof.map(arrayify));
    // if (impliedRoot !== arrayify(trie.root()))
    //   throw new Error(`${hexlify(impliedRoot)} != ${trie.root()}`);
    out(
      JSON.stringify({
        value: v,
        leaf,
        root: trie.root,
        proof: trie.getProof(i),
      })
    );
    return;
  }
}
