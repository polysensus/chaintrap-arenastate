import fs from "fs";
import { isFile } from "./fsutil.js";
import { ProviderSwitch } from "../lib/providercontexts.js";

export async function showProviders(program, options) {
  let cfgs = options.providers;
  if (!isFile(cfgs)) {
    throw new Error(`need a json format file describing the providers`);
  }
  cfgs = JSON.parse(fs.readFileSync(cfgs, "utf-8"));

  const providers = new ProviderSwitch({
    prepared: (name, ctx) => {
      console.log(
        `name: ${name}, type: ${ctx.cfg.type}, chainId: ${ctx.chainId}, url: ${ctx.cfg.url}, ${ctx.cfg.description}`
      );
    },
  });
  await providers.prepare(cfgs);
}
