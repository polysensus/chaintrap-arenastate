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

export class TranscriptOutcome {
  static Invalid = 0;
  static Pending = 1;
  static Rejected = 2;
  static Accepted = 3;
}