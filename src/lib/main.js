// import pkg from "../../package.json" assert { type: "json" };
// export const { version } = pkg;
export { ABIName } from "./abiconst.js";
export {
  abi as ABIArena,
  arenaConnect,
  arenaInterface,
} from "./chaintrapabi.js";
export * from "./deriveaddress.js";
export * from "./gameevents.js";
export { Player } from "./player.js";
export { PlayerProfile } from "./playerprofile.js";
export { PlayerState } from "./playerstate.js";
export { StateRoster, loadRoster } from "./stateroster.js";
export { TxMemo } from "./txmemo.js";
export { MapModel } from "./map/model.js";
