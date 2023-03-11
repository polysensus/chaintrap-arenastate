import { defineConfig } from "vitest/config";
import { configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "test/**"],
    include: ["src/**/*.spec.{js,mjs}", "src/**/*.integ.{js,mjs}"],
  },
});
