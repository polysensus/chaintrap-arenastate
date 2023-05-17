export class ABIName {
  static ArenaFacetName = "ArenaFacet";
  static PlayerJoined = "PlayerJoined";
  static PlayerStartLocation = "PlayerStartLocation";
  static GameCreated = "GameCreated";
  static GameStarted = "GameStarted";
  static GameCompleted = "GameCompleted";
  static UseExit = "UseExit";
  static ExitUsed = "ExitUsed";
  static EntryReject = "EntryReject";
}

export class ABIName2 {
  static GameCreated = "GameCreated";
  static GameStarted = "GameStarted";
  static GameCompleted = "GameCompleted";
  static ParticipantRegistered = "ParticipantRegistered";
  static ActionCommitted = "ActionCommitted";
  static ArgumentProven = "ArgumentProven";
  static OutcomeResolved = "OutcomeResolved";
}

/**
 * Returns true if the event is from the v1 game events interface
 * @param {any} ev ethers parsed event (parsed according to the contract ABI)
 * @returns
 */
export function isV1GameEvent(ev) {
  return !!ABIName[ev.name];
}

/**
 * Returns true if the event is from the v1 game events interface
 * @param {any} ev ethers parsed event (parsed according to the contract ABI)
 * @returns
 */
export function isV2GameEvent(ev) {
  return !!ABIName2[ev.name];
}
