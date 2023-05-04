/**
 * Return a byte array with a bit set for each flag. The order of the names
 * determines the bit position for each flag. If the the earliest name[0] flag
 * is set, it will be found in the *last* returned byte - ie its a big endian
 * interpretation, where the most significant bit is the last flag and it is in
 * the lowest address.
 * @param {string[]]} names
 * @param {Object.<string, boolean>} flags
 */
export function namedFlags(names, flags) {
  const bytes = [];

  // Note: this is far from the most efficient conversion, but it lends itself
  // to a simple implementation.
  for (let i = 0; i < names.length; i++) {
    if (Math.floor(i / 8) >= bytes.length) {
      if (bytes.length == 32)
        throw new Error("flags fields are maximum 32 bytes wide");
      bytes.push(0);
    }

    // Is the flag set ?
    if (!flags[names[i]]) continue;

    const byteBit = i - (bytes.length - 1) * 8;
    console.log(`${i} ${byteBit} ${bytes.length - 1}`);
    bytes[bytes.length - 1] |= 1 << byteBit;
  }

  // now with big endian layout, this puts the earliest flags at the most
  // significant position. we want to invert that, so we just reverse the
  // list. the bit positions of the flags within the individual bytes are
  // un-affected by this.

  bytes.reverse();
  return new Uint8Array(bytes);
}
