import { ObjectType } from "./objecttypes.js";

export class ExitMenu {
  static ObjectType = ObjectType.ExitMenu;

  /**
   * 
   * @param {number[][]} sideExits 
   */
  constructor(sideExits = undefined) {
    this.sideExits = sideExits ?? [];
  }

  inputs() {
    // depth first linearisation, but we know the structure so its obvious
    const inputs = [];
    for (let side = 0; side < this.sideExits.length; side++)
      for (let exit = 0; exit < this.sideExits[side]; exit++) {
        // The choice menu format is [path, value]. For the scene menu the value
        // is the exit index on the specific side of the scene
        inputs.push([side, exit]);
      }
    return inputs;
  }

  prepare() {
    return [ExitMenu.ObjectType, this.inputs()];
  }

  static hydrate(prepared) {
    const choices = {};
    for (const [side, exit] of prepared[1]) {
      const count = choices[side] ?? 0;
      choices[side] = count + 1;
      if (choices[side] != exit + 1)
        throw Error(`bad exit encoding, exit indices should be sequential`);
    }
    const sideExits = [[], [], [], []];
    for (let side = 0; side < sideExits.length; side++)
      sideExits[side] = choices[side] ?? 0;
    return new ExitMenu(sideExits);
  }
}
