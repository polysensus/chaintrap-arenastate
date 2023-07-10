import * as crypto from "crypto";

export const DEFAULT_NAMES = {
  male: "https://www.randomlists.com/data/names-male.json",
  female: "https://www.randomlists.com/data/names-female.json",
  surnames: "https://www.randomlists.com/data/names-surnames.json",
};

export function randomElements(list, count) {
  if (list.length > 65535)
    throw new Error(`65k element list entry limit exceeded`);

  const numbers = new Uint16Array(new Array(count));
  crypto.getRandomValues(numbers);

  const elements = [];
  for (let i = 0; i < numbers.length; i++)
    elements.push(list[numbers[i] % list.length]);

  return elements;
}

export class NameGenerator {
  constructor(options = {}) {
    this.fetch = options.fetch ?? fetch;
    this._maleNames = options.maleNames;
    this._femaleNames = options.femaleNames;
    this._surnames = options.surnames;
  }

  async ensureSurnames() {
    if (this._surnames) return this._surnames;
    const resp = await this.fetch(DEFAULT_NAMES.surnames);
    this._surnames = (await resp.json()).data;
    return this._surnames;
  }

  async getSurnames(count = 1) {
    const names = await this.ensureSurnames();
    return randomElements(names, count);
  }
}
