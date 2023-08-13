import { ObjectType } from "../maptrie/objecttypes.js";
import { LocationChoiceType } from "../maptrie/inputtypes.js";
import { titleCase } from "../strings.js";

/**
 * All located furniture is instanced with this class. Note, this excludes the finish_exit
 */
export class Furnishing {

  /**
   * @param {number} id the identifier the container knows this furnishing by.
   * @param {{
   *   unique_name: string|undefined,
   *   labels: string[],
   *   type: string,
   *   choiceType: string,
   *   data: {location:number, side:number?, exit:number?}
   *   meta: {notes:string[]?}
   * }} item
   */
  constructor(id, item) {
    this.id = id;
    this.type = ObjectType[titleCase(item.type, true /*capitolize*/)];
    if (typeof this.type === "undefined")
      throw new Error(`item type ${item.type} not found`);
    // choiceType may legitemately be undefined
    this.choiceType = item.choiceType ? LocationChoiceType[titleCase(item.choiceType)] : undefined;
    this.item = item;
  }
  get typeName() {
    return this.item.type;
  }
  get location() {
    return this.item.data.location;
  }
  get uniqueName() {
    return this.item.unique_name;
  }
  get unique() {
    return typeof this.uniqueName !== "undefined";
  }
}
