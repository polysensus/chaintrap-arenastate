// libs
import { ethers } from "ethers";
import * as msgpack from "@msgpack/msgpack";
// app

const keccack = ethers.utils.keccak256;
const arrayify = ethers.utils.arrayify;
const hexlify = ethers.utils.hexlify;
const abiCoder = new ethers.utils.AbiCoder();

// Note: this requires that the guardian search the locations for one which
// matches the token.  Ie do a pre-image attack based on knowning player,
// lastEID, hashAlpha.  Observers other than the guardian can't know the
// hashAlpha until after the reveal
// The lastEID is the eid of *previous* move commited by the player and is
// always zero for the first move of each player.
export function scenetoken(playerAddress, location, lastEID, hashAlpha) {
  return keccack(
    abiCoder.encode(
      ["address", "uint16", "uint16", "uint256"],
      [playerAddress, location, lastEID, hashAlpha]
    )
  );
}

export class Scene {
  static decodeblob(sceneblob) {
    // Note ethers gives us hex encoded strings, but msgpack expects byte arrays
    var [token, scene] = msgpack.decode(arrayify(sceneblob));
    token = hexlify(token); // ethers keccack returns hex strings
    return [token, scene];
  }
  static encodeblob(locationToken, scene) {
    // Note: ethers keccack returns a hex string so that is what we work with,
    // but msgpack treats that as actual string data
    locationToken = arrayify(locationToken);
    return msgpack.encode([
      abiCoder.encode(["bytes32"], [locationToken]),
      scene,
    ]);
  }
}
