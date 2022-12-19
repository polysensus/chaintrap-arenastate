// derived from: https://github.com/rollup/rollup-starter-lib/blob/master/rollup.config.js
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import pkg from "./package.json" assert { type: "json" };

export default [
  {
    input: "src/lib/main.js",
    output: {
      inlineDynamicImports: true,
      name: pkg.name,
      file: pkg.browser,
      format: "umd",
    },
    plugins: [json(), resolve(), commonjs()],
  },
  {
    // Note: it is faster to generate multiple builds from the same config
    // where possible
    name: pkg.name,
    input: "src/lib/main.js",
    external: ["ethers", "commander", "@msgpack/msgpack"],
    output: [
      { file: pkg.main, format: "cjs" },
      { file: pkg.module, format: "es" },
    ],
    plugins: [json(), resolve(), commonjs()],
  },
];
