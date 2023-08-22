export function getAllNames(names, cfg) {
  const prefix = cfg?.prefix ?? "ARENASTATE_";
  const group = cfg?.group;
  const env = cfg.env ?? process.env;

  const missing = [];
  const options = {};

  for (const name of names) {
    const value = env[`${prefix}${name}`];
    if (typeof value === "undefined") {
      missing.push(name);
      continue;
    }

    const parts = name.split("_");
    let titleCased =
      group +
      parts
        .map(
          (word) => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase()
        )
        .join("");
    if (!group) titleCased.charAt(0).toLowerCase();

    options[titleCased] = value;
  }

  return {
    options,
    missing,
    missingAny: missing.length !== 0 && names.length != 0,
  };
}
