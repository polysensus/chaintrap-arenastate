import { ObjectType } from "./objecttypes.js";
import { conditionInput } from "./objects.js";

export class ExitMenu {
  static ObjectType = ObjectType.ExitMenu;

  /**
   *
   * @param {number[][]} sideExits
   */
  constructor(sideExits = undefined) {
    this.sideExits = sideExits ?? [];
  }

  /**
   * @param {{side, exit}} choice comprises side and exit index
   * @returns {number} matching input index or undefined
   */
  matchInput(choice) {
    let { side, exit } = choice;
    if (!(side && (exit || exit === 0)))
      throw new Error(
        `MenuExit choice match requires a side and exit selection`
      );

    const inputs = this.inputs({ unconditioned: true });
    for (let i = 0; i < inputs.length; i++)
      if (inputs[i][0] === side && inputs[i][1] === exit) return i;
  }

  inputs(options) {
    // depth first linearisation, but we know the structure so its obvious
    const inputs = [];
    for (let side = 0; side < this.sideExits.length; side++)
      for (let exit = 0; exit < this.sideExits[side]; exit++) {
        // The choice menu format is [path, value]. For the scene menu the value
        // is the exit index on the specific side of the scene
        if (options?.unconditioned) inputs.push([side, exit]);
        else inputs.push([conditionInput(side), conditionInput(exit)]);
      }
    return inputs;
  }

  prepare() {
    return [ExitMenu.ObjectType, this.inputs()];
  }
}
