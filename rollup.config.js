// derived from: https://github.com/rollup/rollup-starter-lib/blob/master/rollup.config.js
import resolve from "@rollup/plugin-node-resolve";
import nodePolyfills from "rollup-plugin-node-polyfills";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import pkg from "./package.json" assert { type: "json" };

const external = [
  "ethers",
  "commander",
  "@msgpack/msgpack",
  "@eth-optimism/sdk",
  "@openzeppelin/merkle-tree",
  "nft.storage",
  "@polysensus/blobcodex",
  "@polysensus/chaintrap-contracts",
  "@polysensus/diamond-deploy",
  "ethereum-cryptography",
];

export default [
  {
    input: "src/lib/main.js",
    external,
    output: [
      {
        inlineDynamicImports: false,
        file: pkg.module,
        format: "es",
        sourcemap: true,
      },
    ],
    plugins: [json(), resolve(), commonjs(), nodePolyfills()],
  },
];
