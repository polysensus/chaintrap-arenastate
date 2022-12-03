// deps
import { ethers } from "ethers";
import * as msgpack from "@msgpack/msgpack";
// app
import { ABIName } from "../lib/abiconst.js";

const bigOne = ethers.BigNumber.from(1);
export const defaultPlayer = ethers.utils.getAddress(
  "0x1111111111111111111111111111111111111111"
);
const defaultLocation = 1;
const defaultScene = {
  corridors: [
    [],
    [{ x: 112.96600183648546, y: 483.82808827089235 }],
    [],
    [
      { x: 165.7023253497456, y: 485.50897035745305 },
      { x: 165.7023253497456, y: 430.9045737954715 },
    ],
  ],
  main: null,
  x: 139.33416359311553,
  y: 450.8786046265011,
  w: 52.73632351326015,
  l: 92.64711174012385,
};
const defaultSceneblob = msgpack.encode(defaultScene);

export function playerJoined({ gid, player } = {}) {
  if (typeof gid === "undefined") {
    gid = bigOne;
  }
  if (typeof player === "undefined") {
    player = defaultPlayer;
  }

  return {
    event: ABIName.PlayerJoined,
    args: {
      gid,
      player,
    },
  };
}

export function playerStartLocation({
  startLocation,
  sceneblob,
  player,
  gid,
  tx,
} = {}) {
  if (typeof gid === "undefined") {
    gid = bigOne;
  }
  if (typeof player === "undefined") {
    player = defaultPlayer;
  }
  if (typeof startLocation === "undefined") {
    startLocation = defaultLocation;
  }
  if (typeof sceneblob === "undefined") {
    sceneblob = defaultSceneblob;
  }

  return {
    event: ABIName.PlayerStartLocation,
    transactionHash: tx,
    args: {
      gid,
      player,
      startLocation,
      sceneblob,
    },
  };
}

export function useExit({ eid, side, egressIndex, player, gid, tx } = {}) {
  if (typeof gid === "undefined") {
    gid = bigOne;
  }
  if (typeof eid === "undefined") {
    eid = 1;
  }
  if (typeof player === "undefined") {
    player = defaultPlayer;
  }
  if (typeof side === "undefined") {
    side = 1;
  }
  if (typeof egressIndex === "undefined") {
    egressIndex = 2;
  }

  return {
    event: ABIName.UseExit,
    transactionHash: tx,
    args: {
      gid,
      eid,
      player,
      exitUse: {
        side,
        egressIndex,
      },
    },
  };
}
