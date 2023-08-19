import { FurnitureTypeCodes } from "./furnitureconst.js";
import { Furnishing } from "./furnishing.js";
export class Furniture {
  static fromJSON(data) {
    return new Furniture(data);
  }

  /**
   *
   * @param {{map,items:[]}} data
   */
  constructor(data) {
    this.init(data);
  }

  byName(name) {
    const it = this.index.identified[name];
    if (!it) throw new Error(`name ${name} not found`);
    return it;
  }

  byTypeName(typeName) {
    return this.byType(FurnitureTypeCodes[typeName]);
  }

  byType(type) {
    const furns = this.index.types[type];
    if (!furns) throw new Error(`type ${type} not found`);
    return [...furns];
  }

  byLocation(location) {
    const furns = this.index.located[location];
    if (!furns) return [];
    return [...furns];
  }

  init(data) {
    this.map = data.map;
    this.items = data.items;
    this.index = {
      types: {},
      identified: {},
      located: {},
      typeByIndex: {},
    };
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const furn = new Furnishing(i, it);

      if (furn.unique) {
        if (furn.uniqueName in this.index.identified)
          throw new Error(`id ${furn.uniqueName} previously defined`);
        this.index.identified[furn.uniqueName] = furn;
      }
      this.index.typeByIndex[i] = furn.type;
      this.index.types[furn.type] = [
        ...(this.index.types[furn.type] ?? []),
        furn,
      ];

      if (typeof furn.location !== "undefined")
        this.index.located[furn.location] = [
          ...(this.index.located[furn.location] ?? []),
          furn,
        ];
    }
  }
}
