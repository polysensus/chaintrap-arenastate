import fs from "fs";
import path from "path";
import { Option } from "commander";

import { readJson } from "./fsutil.js";
import { isFile } from "./fsutil.js";
import { NameGenerator } from "../lib/randomnames.js";
import { BlobCodex } from "@polysensus/blobcodex";

const out = console.log;

function paramToCamel(param) {
  const camel = param
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  return camel.charAt(0).toLowerCase() + camel.slice(1);
}

const generationOptions = [
  ["arena-size", "", 2048.0],
  ["corridor-redundancy", "", 15.0],
  ["flock-factor", "", 600.0],
  ["main-room-thresh", "", 0.8],
  ["min-separation-factor", "", 1.7],
  // ["model", "", "tinykeep"],
  ["room-szmax", "", 1024.0],
  ["room-szmin", "", 512.0],
  ["room-szratio", "", 1.8],
  ["rooms", "", 12],
  ["tan-fudge", "", 0.0001],
  ["tile-snap-size", "", 4.0],
];

export function addMaptool(program) {
  program.exitOverride();
  const command = program.command("maptool");
  command
    .addOption(
      new Option(
        "--maptool-url <maptool-url>",
        "The url hosting the map tool, the commit/ and generate/ request paths are relative to this"
      ).env("ARENASTATE_MAPTOOL_URL")
    )
    .option(
      "--codex-password <password>",
      "used to securely derive an encryption key for the secret map data"
    )
    .option(
      "--codex-generate-password",
      "if --codex-password is not set AND this flag is set, a password is generated. otherwise the map is saved CLEAR TEXT in the codex"
    )
    .option(
      "-f, --codex-filename <filename>",
      "A filename to store the encrypted map data in, otherwise printed to console"
    )
    .option(
      "-p, --parameters <parameters_file>",
      "a json formatted file containing the generation parameters (the cli options take precedence)"
    )
    .option(
      "--svg <filename>",
      "get svg render of the map and save it to filename"
    )
    .option(
      "--map-filename <filename>",
      "save the generated map to this filename"
    )
    .option(
      "--commit-secrets-filename <filename>",
      "save the VRF secret data to this file (lost forever otherwise)"
    );

  for (const [name, description, value] of generationOptions) {
    command.addOption(
      new Option(`--${name} <value>`, description)
        .preset(`${value}`)
        .argParser(parseFloat)
        .default(value)
    );
  }
  command.action((options) => maptool(program, options));
}

export async function maptool(program, options) {
  let info = () => {};
  if (program.opts().verbose) info = console.info;

  let password = options.codexPassword ?? null;
  let passwordGenerated = password ? true : false;
  if (password === null && options.codexGeneratePassword) {
    const g = new NameGenerator({ fetch });
    password = (await g.getSurnames(2)).join("-");
    passwordGenerated = true;
  }

  const codex = new BlobCodex();
  await codex.derivePasswordKeys([password]);

  let params = {}; // generation params
  if (isFile(options.parameters)) params = readJson(options.parameters);
  params.model = "tinykeep";
  for (const [name] of generationOptions) {
    const option = paramToCamel(name);
    params[name.split("-").join("_")] = options[option];
  }

  var req = {
    credentials: "omit",
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      gp: params,
    }),
  };
  info(JSON.stringify(req, null, "  "));

  let baseUrl = options.maptoolUrl;
  if (!baseUrl.endsWith("/")) baseUrl = baseUrl + "/";
  let url = `${baseUrl}commit/`;
  let resp = await fetch(url, req);
  const committed = await resp.json();
  if (options.commitSecretsFilename) {
    fs.writeFileSync(
      options.commitSecretsFilename,
      JSON.stringify(committed, null, "  ")
    );
  }
  codex.addItem(codex.dataFromObject(committed), {
    name: "committed",
    content_type: "application/json",
    encrypted: password !== null,
  });

  req.body = JSON.stringify({
    public_key: committed.public_key,
    alpha: committed.alpha,
    beta: committed.beta,
    pi: committed.pi,
  });

  url = `${baseUrl}generate/`;
  info(`generating for alpha string: ${committed.alpha}`);
  resp = await fetch(url, req);
  const map = await resp.json();
  const mapData = JSON.stringify(map, null, "  ");
  out(mapData);
  if (options.mapFilename) fs.writeFileSync(options.mapFilename, mapData);
  codex.addItem(codex.dataFromObject(map), {
    name: "map",
    content_type: "application/json",
    encrypted: password !== null,
  });

  if (options.svg) {
    url = `${url}?svg=true`;
    resp = await fetch(url, req);
    const svg = await resp.text();
    fs.writeFileSync(options.svg, svg);
    codex.addItem(
      codex.dataFromObject({
        filename: path.basename(options.svg),
        content: svg,
      }),
      { name: "svg", content_type: "image/svg+xml" }
    );
  }

  const data = JSON.stringify(codex.serialize(), null, " ");
  if (options.codexFilename) fs.writeFileSync(options.codexFilename, data);
  else console.log(data);

  if (!passwordGenerated) console.error("generated password", password);
}
