import { defineConfig } from "vitest/config";
import { configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    // hardhat tests use moch and live in "test/**"
    exclude: [...configDefaults.exclude, "test/**", "src/**/*.mocha.js"],
    include: ["src/**/*.spec.{js,mjs}", "src/**/*.integ.{js,mjs}"],
  },
});
