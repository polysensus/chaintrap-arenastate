import path from "path";
import { ethers } from "ethers";

export function contractNameFromABIFileName(filename) {
  var name = path.basename(filename);
  if (name.endsWith(".json")) {
    const i = name.lastIndexOf(".json");
    name = name.slice(0, i);
  }
  return name;
}

export class ABILoader {
  static GetUnique = undefined;
  static GetFirst = 1;
  static GetLast = 2;
  static GetAll = 3;

  /** constructor
   * @param {*} finders instances of file system finders, see FoundrFinder for example
   */
  constructor(reporter, ...finders) {
    this.reporter = reporter;
    this.finders = [];
    this.interfaces = {};
    if (finders?.length) this.addFinders(...finders);
  }

  addFinders(...finders) {
    this.finders.push(...finders);
  }

  load() {
    for (const [finder, filenames] of this.findabifiles()) {
      for (const filename of filenames) {
        const iface = this.readInterface(finder, filename);
        if (iface === null) continue;
        this.addInterface(iface, filename, finder);
      }
    }
  }

  get(name, constraint) {
    const variants = this.intefaces[name] ?? [];
    if (variants.length == 0) throw new Error(`ABILoader: not-found ${name}`);

    // always return a list if doing a GetAll, even for single entry names
    if (constraint == ABILoader.GetAll) return [...variants];

    if (Number.isInteger(constraint)) {
      if (constraint >= variants.length)
        throw new Error(
          `ABILoader: bad-constraint (range) ${name} ${constraint}`
        );
      return variants[constraint];
    }

    if (variants.length == 1) return variants[0];
    if (constraint == APILoader.GetUnique)
      throw Error(`ABILoader: not-unique ${name}`);
    if (constraint == ABILoader.GetFirst) return variants[0];
    if (constraint == ABILoader.GetLast) return variants[variants.length - 1];

    throw new Error(`ABILoader: bad-constraint ${name} (type) ${constraint}`);
  }

  *list() {
    for (const name of Object.keys(this.interfaces)) {
      for (const variant of this.interfaces[name]) yield [name, ...variant];
    }
  }

  addInterface(iface, filename, finder) {
    const name = contractNameFromABIFileName(filename);
    const variants = this.interfaces[name] ?? [];
    variants.push([iface, filename, finder]);
    this.interfaces[name] = variants;
  }

  reset() {
    this.intefaces = {};
  }

  *findabifiles() {
    for (const finder of this.finders) {
      yield [finder, finder.find()];
    }
  }

  readInterface(finder, filename) {
    const abi = finder.readAbi(filename);
    if (abi == null) return null;

    return new ethers.utils.Interface(abi);
  }
}
