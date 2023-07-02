export function getMap(collection, name = undefined) {
  if (!name) {
    const names = Object.keys(collection);
    if (names.length === 0) throw new Error("empty map collection");

    name = names.sort()[0];
  }
  const map = collection[name];
  if (!map) throw new Error(`${name} not found in map collection`);
  return { map, name };
}
