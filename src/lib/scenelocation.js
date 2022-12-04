import { ethers } from "ethers";
import * as msgpack from "@msgpack/msgpack";

/**
 * Return the opposite side. Eg for east return west
 * @param {number} side
 */
export function oppositeSide(side) {
  // note: js % is 'remainder' not modulus but we know that all valid values
  // here are same sign (positive). so they are equivelant.
  return (side + 2) % 4;
}

/**
 * Given the room of egress return the room of ingress and the side
 * @param {*} room
 * @returns
 */
export function egressingEnters(c, room) {
  if (c.joins[0] === room) return [c.joins[1], c.join_sides[1]];
  if (c.joins[1] === room) return [c.joins[0], c.join_sides[0]];
  throw new Error(`room ${room} is not on either end of this corridor`);
}

/**
 * Check that corridor enters the room on the expected side and exit
 * @param {*} r
 * @param {number} corridor
 * @param {number} side
 */
export function ingressingExit(r, corridor, side) {
  for (let exit = 0; exit < r.corridors[side].length; exit++) {
    if (corridor === r.corridors[side][exit]) return exit;
  }
  return -1;
}

/**
 * NOTICE the blob encryption is tbd for now
 *
 * Anywhere a parameter sharedkey or hostkey is needed just pass 'true' for now
 * Only pass hostkey
 * Play is to use https://github.com/bitchan/eccrypto
 * Then do a key exchange for the public part so only the player can read it.
 * And a normal encrypt for the location part so only the host can read it.
 * Note: see bob bucanan for a smart contract friendly symetric key exchange
 */
export function locationBlobToken(location, blob) {
  return ethers.utils.solidityKeccak256(["uint16", "bytes"], [location, blob]);
}

export function tokenize(location, sceneblob, locationblob) {
  const blob = msgpack.encode([sceneblob, locationblob]);
  const token = locationBlobToken(location, blob);
  return [token, blob];
}

export class SceneLocation {
  /*eslint-disable */
  /* eslint-enable */

  static fromBlob(blob, sharedkey, hostkey) {
    // TODO:
    if (!sharedkey) throw new Error("the shared key is required");

    // @ts-ignore
    const sloc = new SceneLocation({ blob });
    sloc.decode(sharedkey, hostkey);
    return sloc;
  }

  // @ts-ignore
  constructor({ location, scene, blob, token } = {}) {
    if (blob && !ethers.utils.isBytes(blob)) {
      blob = ethers.utils.arrayify(blob);
    }

    this._location = location;
    this._scene = scene;
    this._blob = blob;
    this._token = token;
    if (this._location && this._blob) {
      this._token = locationBlobToken(this._location, this._blob);
      if (token && token !== this._token) {
        throw new Error(
          `expected and actual tokens don't match ${token} vs actual: ${this._token}`
        );
      }
    }
  }

  get location() {
    return this._location;
  }

  get token() {
    return this._token;
  }

  get blob() {
    return this._blob;
  }

  get scene() {
    return this._scene;
  }

  // get sceneID() {
  //   return this._sceneID
  // }

  decode(sharedkey, hostkey) {
    if (!sharedkey) throw new Error("the shared key is required");
    if (!this._blob) throw new Error("cannot decode without the original blob");

    // @ts-ignore
    [this._sceneblob, this._locationblob] = msgpack.decode(this._blob);

    // this._sceneID = ethers.utils.id(this._sceneblob);

    // TODO: use the shared key here
    this._scene = msgpack.decode(this._sceneblob);
    // TODO: use the hostkey key here
    if (hostkey) {
      // @ts-ignore
      this._location = msgpack.decode(this._locationblob);
      this._token = locationBlobToken(this._location, this._blob);
    }
    return this._scene;
  }

  tokenize(sharedkey, hostkey) {
    if (
      !(
        typeof this._location !== "undefined" &&
        typeof this._scene !== "undefined"
      )
    )
      throw new Error(
        "cannot tokenize without both the location and the scene"
      );
    if (!sharedkey) throw new Error("the shared key is required");
    if (!hostkey) throw new Error("the host key is required");

    // TODO: encrypt using shared key
    this._sceneblob = msgpack.encode(this._scene);

    // TODO: encrypt using host key
    this._locatioblob = msgpack.encode(this._location);
    [this._token, this._blob] = tokenize(
      this._location,
      this._sceneblob,
      this._locatioblob
    );
    return [this._token, this._blob];
  }
}
