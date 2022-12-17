import fs from "fs";
import { ethers } from "ethers";
import { getArenaAddress } from "./arenaaddress.js";
import { arenaConnect } from "../lib/chaintrapabi.js";
import { isFile, readHexKey } from "./fsutil.js";
import { prepareProviders } from "../lib/providercontexts.js";

export async function showProviders(program, options) {
  let cfgs = options.providers;
  if (!isFile(cfgs)) {
    throw new Error(`need a json format file describing the providers`);
  }
  cfgs = JSON.parse(fs.readFileSync(cfgs, "utf-8"));

  const providers = await prepareProviders(cfgs);
  for (const ctx of Object.values(providers)) {
    console.log(`name: ${ctx.cfg.name}, type: ${ctx.cfg.type}, chainId: ${ctx.chainId}, url: ${ctx.cfg.url}, ${ctx.cfg.description}`)
    ctx.stopListening()
  }
}