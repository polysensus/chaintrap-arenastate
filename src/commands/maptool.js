import fs from "fs";
import { Option } from "commander";

import { readJson } from "./fsutil.js";
import { isFile } from "./fsutil.js";

const out = console.log;

function paramToCamel(param) {
  const camel = param.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join("");
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
  ["tile-snap-size", "", 4.0]
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
    .option("-p, --parameters <parameters_file>", "a json formatted file containing the generation parameters (the cli options take precedence)")
    .option("--svg <filename>", "get svg render of the map and save it to filename")
    .option("--map-filename <filename>", "save the generated map to this filename")
    .option("--commit-secrets-filename <filename>", "save the VRF secret data to this file (lost forever otherwise)")
    .option("--password <password>", "used to securely derive an encryption key for the secret map data")
    // Note the small default iteration count here. It is likely we will
    // encourage that maps are revealed after the game. not sure yet. but in any
    // event, the data protected by this key is not considered very sensitive at
    // the moment.
    .option("--password-guess-resistance", "the number of iterations used in generating the key, lower is faster but more vulnerable to guessing. we are only protecting game maps.", 1000)


  for (const [name, description, value] of generationOptions) {
    command.addOption(
      new Option(
        `--${name} <value>`, description
      ).preset(`${value}`).argParser(parseFloat).default(value)
    )
  }
  command.action((options) => maptool(program, options));
}

export async function maptool(program, options) {

  let info = () => {}
  if (program.opts().verbose)
    info = console.info;

  let aesKey;
  if (options.password)
    aesKey = await deriveAESKey(options.password);

  let params = { }; // generation params
  if (isFile(options.parameters))
    params = readJson(options.parameters)
  params.model = "tinykeep";
  for (const [name] of generationOptions) {
    const option = paramToCamel(name)
    params[name.split('-').join('_')] = options[option];
  }

  var req = {
    credentials: 'omit',
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      gp: params
    })
  }
  info(JSON.stringify(req, null, '  '));

  let baseUrl = options.maptoolUrl;
  if (!baseUrl.endsWith('/'))
    baseUrl = baseUrl + '/';
  let url = `${baseUrl}commit/`;
  let resp = await fetch(url, req);
  const committed = await resp.json();
  if (options.commitSecretsFilename) {
    fs.writeFileSync(options.commitSecretsFilename, JSON.stringify(committed, null, '  '));
  } else
    info(JSON.stringify(committed)); // reveals the secret data on stdout if --verbose is set

  req.body = JSON.stringify({
      public_key: committed.public_key,
      alpha: committed.alpha,
      beta: committed.beta,
      pi: committed.pi
    })

  url = `${baseUrl}generate/`;
  info(`generating for alpha string: ${committed.alpha}`);
  resp = await fetch(url, req)
  const map = await resp.json()
  const mapData = JSON.stringify(map, null, '  ');
  out(mapData);
  if (options.mapFilename) {
    fs.writeFileSync(options.mapFilename, mapData);
  }
  if (options.svg) {
    url = `${url}?svg=true`;
    resp = await fetch(url, req)
    const svg = await resp.text();
    fs.writeFileSync(options.svg, svg);
  }
}