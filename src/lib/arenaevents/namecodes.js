// v1 chaintrap contract events as v2 data blobs on generalized commitments

/**
 * Name symbols for each of the defined types of data emitted by the contract
 * logs.
 *
 * The logs emitted by game events have a data field which is a small msgpack
 * encoded and typed piece of of chain data. The format is [code, ...] where
 * code is allocate by this file.
 */
export class DataTypes {
  static Invalid = "Invalid";
  static UseExit = "UseExit";
  static ExitUsed = "ExitUsed";
  static EntryReject = "EntryReject";
  static UseToken = "UseToken";
  static FurnitureUsed = "FurnitureUsed";
  static TranscriptPlayerEnteredLocation = "TranscriptPlayerEnteredLocation";
  static TranscriptPlayerKilledByTrap = "TranscriptPlayerKilledByTrap";
  static TranscriptPlayerDied = "TranscriptPlayerDied";
  static TranscriptPlayerGainedLife = "TranscriptPlayerGainedLife";
  static TranscriptPlayerLostLife = "TranscriptPlayerLostLife";
  static TranscriptPlayerVictory = "TranscriptPlayerVictory";
}

// note map enumeration order is undefined so we cant use Object.keys
const Names = [
  DataTypes.Invalid,
  DataTypes.UseExit,
  DataTypes.ExitUsed,
  DataTypes.EntryReject,
  DataTypes.UseToken,
  DataTypes.FurnitureUsed,
  DataTypes.TranscriptPlayerEnteredLocation,
  DataTypes.TranscriptPlayerKilledByTrap,
  DataTypes.TranscriptPlayerDied,
  DataTypes.TranscriptPlayerGainedLife,
  DataTypes.TranscriptPlayerLostLife,
  DataTypes.TranscriptPlayerVictory,
];

export const NameCodes = {};
export const CodeNames = {};

for (let i = 0; i < Names.length; i++) {
  Object.defineProperty(NameCodes, Names[i], { value: i, writable: false });
  Object.defineProperty(CodeNames, i, { value: Names[i], writable: false });
}
Object.seal(NameCodes);
Object.seal(CodeNames);
