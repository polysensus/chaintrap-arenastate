// libs
import { ethers } from "ethers";
// app
import { getLogger } from "../log.js";

const log = getLogger("SceneCatalog");
const keccack = ethers.utils.keccak256;
const abiCoder = new ethers.utils.AbiCoder();

// Note: this requires that the guardian search the locations for one which
// matches the token.  Ie do a pre-image attack based on knowning player,
// lastEID, hashAlpha.  Observers other than the guardian can't know the
// hashAlpha until after the reveal
// The lastEID is the eid of *previous* move commited by the player and is
// always zero for the first move of each player.
export function scenetoken(player, location, lastEID, hashAlpha) {
  return keccack(
    abiCoder.encode(
      ["address", "uint16", "uint16", "uint256"],
      [player, location, lastEID, hashAlpha]
    )
  );
}

export class SceneCatalog {
  construct() {}

  /**
   *
   * @param {object} model as the raw json object representation obtained from the generator api
   */
  load(map) {
    this.hashAlpha = ethers.utils.sha256(
      ethers.utils.toUtf8Bytes(map.vrf_inputs.alpha)
    );
    const model = map.model;

    this.scenes = []; // 1:1 with rooms
    for (var i = 0; i < model.rooms.length; i++) {
      const [scene, issues] = createScene(model.rooms, model.corridors, i);
      if (issues.length > 0) {
        throw new Error(`issues with room ${i}: ${JSON.stringify(issues)}`);
      }
      this.scenes.push(scene);
    }
  }
  scenetoken(player, lastEID) {
    return scenetoken(player, lastEID, this.hashAlpha);
  }
}

export function createScene(rooms, corridors, roomIndex) {
  if (roomIndex >= rooms.length) {
    throw Error(`room ${roomIndex} out of range. have ${rooms.length}`);
  }

  const sceneCorridors = [[], [], [], []];
  const room = rooms[roomIndex];
  const issues = [];

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < room.corridors[i].length; j++) {
      const ic = room.corridors[i][j];
      const roomside = i;
      // get the point matching the roomside

      let exitpoint;
      if (corridors[ic].join_sides[0] === roomside) {
        exitpoint = corridors[ic].points[0];
      } else if (corridors[ic].join_sides[1] === roomside) {
        exitpoint = corridors[ic].points[corridors[ic].points.length - 1];
      } else {
        issues.push([roomside, ic]);
        continue;
      }
      sceneCorridors[i].push({ x: exitpoint[0], y: exitpoint[1] });
    }
  }

  return [
    {
      corridors: sceneCorridors,
      main: room.main,
      inter: room.inter,
      x: room.x,
      y: room.y,
      w: room.w,
      l: room.l,
    },
    issues,
  ];
}
