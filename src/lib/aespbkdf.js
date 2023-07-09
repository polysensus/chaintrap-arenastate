import * as crypto from "crypto";

// https://billatnapier.medium.com/symmetric-key-encryption-with-pbkdf2-and-node-js-846ac57901c1

export const SALT_BYTES = 16;

// DO NOT USE THE DEFAULT iteration count if using the key for protecting things
// other than maps and dungeon furniture placements.
//
// We have a small default because the key is intended for maps and map
// furniture placement. This is data that gets revealed incrementally as games
// are played anyway. 
export const DEFAULT_ITERATIONS = 1000;
export const MIN_ITERATIONS = DEFAULT_ITERATIONS;

export const PBKDF_KEY_LEN = 32; // AES requirement
export const PBKDF_HASH_ALG='sha512';

export const DEFAULT_AES_ALG = 'aes-256-gcm';
export const AES_IV_LEN = 16;

export const AUTH_TAG_LEN = 16;

export function encryptData(cipher, data) {
  let enc = cipher.update(data);
  return Buffer.concat([enc, cipher.final()]);
}

/**
 * Create a cipher context for encrypting data
 * @param {*} key 
 * @param {{iv?,alg?}} options 
 * @returns {{cipher,iv,alg}}
 */
export function createCipher(key, options={}) {
  let {iv, alg} = options;
  if (!iv)
    iv = crypto.randomBytes(AES_IV_LEN);
  if (!alg)
    alg = DEFAULT_AES_ALG;

  const cipher = crypto.createCipheriv(alg, Buffer.from(key), iv, {authTagLength: AUTH_TAG_LEN});
  return {cipher, iv, alg};
}

export function createDecipher(key, options) {
  let {iv, alg, tag} = options;
  if (!tag)
    throw new Error(`the authentication tag is required`);
  if (!iv)
    throw new Error('iv is a required option')
  if (!alg)
    alg = DEFAULT_AES_ALG;

  const o = {...options, authTagLength: AUTH_TAG_LEN};
  delete o['alg'];
  delete o['iv'];

  const decipher = crypto.createDecipheriv(alg, key, iv, o);
  decipher.setAuthTag(tag);
  return decipher;
}

/**
 * Derive an AES encryption key
 * @param {string} password 
 * @param {{salt?,iteration?}} options  a suitable default salt is generated, the default iterations are quite low
 * @returns {{salt,key}} the salt and a key appropriate for use with AES encryption
 */
export async function deriveAESKey(password, options={}) {
  let {salt, iterations} = options;
  if (!salt)
    salt = crypto.randomBytes(SALT_BYTES);
  if (typeof iterations === 'undefined')
    iterations = DEFAULT_ITERATIONS;

  if (typeof iterations === 'number' && iterations < MIN_ITERATIONS)
    throw new Error(`${iterations} is less than ${MIN_ITERATIONS}, this isn't sensible or safe`);

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, PBKDF_KEY_LEN, PBKDF_HASH_ALG, (err, derivedKey) => {
      if (err) reject(err);
      else resolve({salt, key:derivedKey});
    });
  });
}
