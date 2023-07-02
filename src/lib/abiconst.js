export class ABIName {
  static TranscriptCreated = "TranscriptCreated";
  static TranscriptStarted = "TranscriptStarted";
  static TranscriptCompleted = "TranscriptCompleted";
  static TranscriptRegistration = "TranscriptRegistration";
  static TranscriptMerkleRootSet = "TranscriptMerkleRootSet";
  static TranscriptEntryChoices = "TranscriptEntryChoices";
  static TranscriptEntryCommitted = "TranscriptEntryCommitted";
  static TranscriptEntryOutcome = "TranscriptEntryOutcome";
}

/**
 * Returns true if the event is from the v1 game events interface
 * @param {any} ev ethers parsed event (parsed according to the contract ABI)
 * @returns
 */
export function isV2GameEvent(ev) {
  return !!ABIName[ev.name];
}
