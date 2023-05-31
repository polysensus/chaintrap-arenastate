export class ABIName {
  static ArenaFacetName = "ArenaFacet";
  static PlayerJoined = "PlayerJoined";
  static PlayerStartLocation = "PlayerStartLocation";
  static TranscriptCreated = "TranscriptCreated";
  static TranscriptStarted = "TranscriptStarted";
  static TranscriptCompleted = "TranscriptCompleted";
  static UseExit = "UseExit";
  static ExitUsed = "ExitUsed";
  static EntryReject = "EntryReject";
}

export class ABIName2 {
  static TranscriptCreated = "TranscriptCreated";
  static TranscriptStarted = "TranscriptStarted";
  static TranscriptCompleted = "TranscriptCompleted";
  static TranscriptRegistration = "TranscriptRegistration";
  static TranscriptMerkleRootSet = "TranscriptMerkleRootSet";
  static TranscriptEntryChoices = "TranscriptEntryChoices";
  static TranscriptEntryCommitted = "TranscriptEntryCommitted";
  static ArgumentProven = "ArgumentProven";
  static TranscriptEntryOutcome = "TranscriptEntryOutcome";
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
