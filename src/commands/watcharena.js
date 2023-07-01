import fs from "fs";
import ora from "ora";

import { isFile } from "./fsutil.js";
import {
  ProviderContext,
  ProviderSwitch,
} from "../lib/chainkit/providercontexts.js";
const out = console.log;

export function addWatchArena(program) {
  program
    .command("watch")
    .description("watch for events on the arena contract")
    .option("-p, --providers <filename>")
    .option(
      "-w, --which <which>",
      "name of the provider entry in providers file",
      "caimst"
    )
    .action((options) => watchArena(program, options));
}

export async function watchArena(program, options) {
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
  await providers.prepare(cfgs, (cfg) => new ProviderContext(cfg));
  const ctx = await providers.select(options.which);
  let signer = ctx.signer;

  if (!signer) {
    let signer = program.opts().key;
    if (signer) {
      if (isFile(signer)) {
        signer = readHexKey(signer);
      }
      signer = new ethers.Wallet(signer, ctx.provider);
    }
  }
  /*
  const provider = signer || ctx.provider;
  const arenaAddress = await getArenaAddress(program, options, provider);
  const arena = arenaConnect(arenaAddress, provider);

  const dispatcher = new Dispatcher(arena);
  dispatcher.addHandler((ev) => {
    out(`
    event: ${ev.name}
    ${JSON.stringify(ev.args)}
    `);
  }, ABIName.TranscriptCreated);
  dispatcher.startListening();
  */

  const spinner = ora(`waiting for events`).start();
  setTimeout(() => {
    spinner.color = "yellow";
  }, 1000);
}
