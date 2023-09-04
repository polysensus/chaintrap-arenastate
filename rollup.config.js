// derived from: https://github.com/rollup/rollup-starter-lib/blob/master/rollup.config.js
import resolve from "@rollup/plugin-node-resolve";
import nodePolyfills from "rollup-plugin-node-polyfills";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import pkg from "./package.json" assert { type: "json" };

const externalxx = [
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
    external: externalxx,
    output: {
      inlineDynamicImports: true,
      name: pkg.name,
      file: pkg.browser,
      format: "umd",
    },
    plugins: [json(), resolve(), commonjs(), nodePolyfills()],
  },
  {
    // Note: it is faster to generate multiple builds from the same config
    // where possible
    // name: pkg.name,
    input: "src/lib/main.js",
    external: externalxx,
    output: [
      {
        inlineDynamicImports: true,
        file: pkg.main,
        format: "cjs",
        sourcemap: true,
      },
      {
        inlineDynamicImports: true,
        file: pkg.module,
        format: "es",
        sourcemap: true,
      },
    ],
    plugins: [json(), resolve(), commonjs(), nodePolyfills()],
  },
];
