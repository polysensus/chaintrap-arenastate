import * as msgpack from "@msgpack/msgpack";

import { ethers } from "ethers";
import { NameCodes } from "./namecodes.js";

const decodingHooks = {};

// decodingHooks[NameCodes.ExitUsed] = (eventData) => {
//   eventData.args.location = ethers.utils.hexlify(eventData.args.location);
//   eventData.args.sceneblob = ethers.utils.hexlify(eventData.args.sceneblob);
//   return eventData;
// }

/**
 * This class encodes v1 style explicit game state method calls to encoded event
 * data. Note that the gid and eid are not included in any data payload. gid is
 * provided as an explicit argument to all the contract calls, and is also
 * emitted by all game events explicitly. eid is tracked internally on the
 * contracts and emitted explicitly for the events for which it makes sense.
 *
 * idiomatic use:
 *  msgpack.encode(EventData.commitExitUse(North, 2))
 *
 *  new EventData(EventData.commitExitUse(North, 2))
 */
export class EventData {
  /**
   * @constructor
   * @param {any} use the static methods to create properly formed eventData
   */
  constructor(eventData) {
    const hook = decodingHooks[eventData.event];
    if (hook) eventData = hook(eventData);
    Object.assign(this, eventData);
    this.event = CodeNames[this.event];
  }

  encode() {
    return msgpack.encode(this);
  }

  static decode(data) {
    return new EventData(msgpack.decode(data));
  }

  // Note: gid and tid are always emitted by the contracts explicitly

  /**
   * @param {number} side
   * @param {number} egressIndex
   */
  static commitExitUse(side, egressIndex) {
    return {
      type: NameCodes.UseExit,
      args: {
        side,
        egressIndex,
      },
    };
  }

  /**
   * Notice! eid is not provided for v2 events, each participant has a cursor on the contract state.
   * @param {ethers.utils.DataHexString} token
   * @param {ethers.utils.DataHexString} scene
   * @param {number} side
   * @param {number} ingressIndex
   * @param {boolean} halt
   */
  static allowExitUse(token, scene, side, ingressIndex, halt) {
    return {
      type: NameCodes.ExitUsed,
      args: {
        location: ethers.utils.arrayify(token),
        sceneblob: ethers.utils.arrayify(scene),
        side,
        ingressIndex,
        halt,
      },
    };
  }
}

/* Don't need these, they are explicitly emitted
static startGame2() {
  return {
    event:NameCodes.GameStarted
  };
}

static completeGame() {
  return {
    event:NameCodes.GameCompleted
  }
}*/

/*
    GameCreated:
        TEID eid,
        address indexed creator, uint256 maxPlayers
    GameStarted:
        TEID eid,
    GameCompleted:
        TEID eid,
    PlayerJoined:
        TEID eid,
      address player, bytes profile

    PlayerStartLocation:
        TEID eid,
        address player,
        bytes32 startLocation,
        bytes sceneblob
    );

    UseExit:
        TEID eid,
        address indexed player,
        ExitUse exitUse:
          side
          egressIndex

    ExitUsed
        TEID eid,
        address indexed player,
        ExitUseOutcome outcome:
          location (token)
          sceneblob
          side
          ingressIndex
          halt
    EntryReject:
        TEID eid,
        address indexed player,
        bool halted

    // UseToken isn't wired into the state roster yet
    UseToken:
        TEID eid,
        address indexed participant,
        FurnitureUse use:
          token


    FurnitureUsed
        TEID eid,
        address indexed participant,
        FurnitureUseOutcome outcome:
          kind: Undefined, Finish, Trap, Boon, Invalid
          effect: Undefined, Victory, Death: FreeLife, Invalid
          blob
          halt

    // The following events are emitted by transcript playback to reveal the full narrative of the game
    // for V2, this isn't on chain, it is all in the event data. symmetrically encrypted if necessary
    // also, they have no effect on the dispatcher or player state accumulation in the stateroster
    event TranscriptPlayerEnteredLocation(
        uint256 indexed gameId,
        TEID eid,
        address indexed player,
        LocationID indexed entered,
        ExitID enteredVia,
        LocationID left,
        ExitID leftVia
    );

    event TranscriptPlayerKilledByTrap(
        uint256 indexed gameId,
        TEID eid,
        address indexed player,
        LocationID indexed location,
        uint256 furniture
    );

    event TranscriptPlayerDied(
        uint256 indexed gameId,
        TEID eid,
        address indexed player,
        LocationID indexed location,
        uint256 furniture
    );

    event TranscriptPlayerGainedLife(
        uint256 indexed gameId,
        TEID eid,
        address indexed player,
        LocationID indexed location,
        uint256 furniture
    );

    // only when player.lives > 0
    event TranscriptPlayerLostLife(
        uint256 indexed gameId,
        TEID eid,
        address indexed player,
        LocationID indexed location,
        uint256 furniture
    );

    event TranscriptPlayerVictory(
        uint256 indexed gameId,
        TEID eid,
        address indexed player,
        LocationID indexed location,
        uint256 furniture
    );

    event GameReset(GameID indexed gid, TID tid); DON'T NEED
*/
