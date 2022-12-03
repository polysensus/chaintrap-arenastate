import log from "loglevel";
import * as dotenv from "dotenv";
dotenv.config();

// const enabled = undefined
const disabled = {
  TxMemo: true,
  // , StateRoster: true
};
const enabled = undefined;
const levels = {
  StateRoster: "INFO",
};

export function getLogger(name) {
  const defaultLevel = process?.env?.ARENASTATE_LOGLEVEL ?? "INFO";
  const enable = typeof enabled === "undefined" || enabled[name];
  const disable =
    typeof disabled !== "undefined" && typeof disabled[name] !== "undefined";
  const level = levels?.[name] ?? defaultLevel;

  const _log = log.getLogger(Symbol.for(name));
  if (!enable || disable) {
    _log.setLevel("ERROR");
    return _log;
  }
  _log.setLevel(level);
  return _log;
}
