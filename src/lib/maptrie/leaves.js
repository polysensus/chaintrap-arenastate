export class GenericLeaf {
  // the openzeppelin implementation double hashes the leaves to avoid second pre-image issues.
  static ABI = [
    // We either commit to a single leaf type and structure or we encode type.
    // We ensure each identified type has a fixed layout in order to avoid
    // ambiguous encodings.
    // flags, type
    "uint8",
    "bytes15",
    "bytes",
  ];
}

// If we encode the different types in distinct trees we can (and should) use
// fixed leaf types.  We will almost certainly want a separate tree for placable
// items etc. We may want a trie we can update for dynamic state.
export class LinkLeaf {
  static ABI = [
    "tuple(uint16 location, uint16 side, uint16 access)",
    "tuple(uint16 location, uint16 side, uint16 access)",
  ];
}
