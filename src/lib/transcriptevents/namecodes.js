// v1 chaintrap contract events as v2 data blobs on generalised commitments

export const Names = [
  "Invalid",
  "GameCreated",
  "GameReset",
  "GameStarted",
  "GameCompleted",
  "PlayerJoined",
  "PlayerStartLocation",
  "UseExit",
  "ExitUsed",
  "EntryReject",
  "UseToken",
  "FurnitureUsed",
  "TranscriptPlayerEnteredLocation",
  "TranscriptPlayerKilledByTrap",
  "TranscriptPlayerDied",
  "TranscriptPlayerGainedLife",
  "TranscriptPlayerLostLife",
  "TranscriptPlayerVictory",
];

export const NameCodes = {};
export const CodeNames = {};

for (let i = 0; i < Names.length; i++) {
  Object.defineProperty(NameCodes, Names[i], { value: i, writable: false });
  Object.defineProperty(CodeNames, i, { value: Names[i], writable: false });
}
Object.seal(NameCodes);
Object.seal(CodeNames);
