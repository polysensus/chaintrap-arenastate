import { ethers } from "ethers";

/**
 * Convert a number to the corresponding git token. Eg
 * if num = 1, return ethers.BigNumber.fromhex('0x04000000000000000000000000000001')
 * @param {number} num
 */
export function numberToGid(num) {
  // the low order 16 bytes is the instance, the highest order byte is the type.
  // the highest order is big endian so on the left
  const bytes = new Uint8Array(17);
  bytes[0] = 4;
  const gid = ethers.BigNumber.from(bytes);
  return gid.add(num);
}

export function gidEnsureType(gid) {
  const bytes = ethers.utils.arrayify(gid.toHexString());
  if (bytes.length > 17)
    throw new Error(`gid ${gid} to large`);

  if (bytes.length === 17) {
    if (bytes[0] !== 4 && bytes[0] !== 0)
      throw new Error(`gid ${gid} as pre existing and incorrect type id`);
    bytes[0] = 4;
    return ethers.BigNumber.from(bytes);
  }

  const empty = new Uint8Array(17 - bytes.length);
  empty[0] = 4
  return ethers.BigNumber.from(ethers.utils.concat(empty, bytes));
}

/**
 * 
 * @param {number|ethers.BigNumber|string} value 
 */
export function asGid(value) {
  if (value.constructor.name === 'Number')
    return numberToGid(value);
  if (value.constructor.name === 'BigNumber')
    return gidEnsureType(value);
  return gidEnsureType(ethers.BigNumber.from(value));
}
