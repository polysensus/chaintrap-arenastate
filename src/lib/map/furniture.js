export class Furniture {
  static fromJSON(data) {
    return new Furniture(data);
  }
  constructor(data) {
    this.init(data);
  }

  byName(name) {
    const it = this.index.identified[name];
    if (!it) throw new Error(`name ${name} not found`);
    return it;
  }

  init(data) {
    this.map = data.map;
    this.items = data.items;
    this.index = {
      types: {},
      identified: {},
    };
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];

      it.id = i; // the id is the index in the items array

      if (it.unique_name) {
        if (it.unique_name in this.index.identified)
          throw new Error(`id ${it.unique_name} previously defined`);
        this.index.identified[it.unique_name] = it;
      }
      if (it.type)
        this.index.types[it.type] = [...(this.index.types[it.type] ?? []), it];
    }
  }
}
