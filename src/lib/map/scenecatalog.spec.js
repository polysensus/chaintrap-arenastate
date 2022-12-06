import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

import { ethers } from "ethers";

import { ABIName } from "../abiconst.js";
import { arenaInterface } from "../chaintrapabi.js";
import { connectedRooms, targetRoom } from "./model.js";
import { SceneCatalog, scenetoken } from "./scenecatalog.js";
import { StateRoster } from "../stateroster.js";
import { parseEventLog, playerFromParsedEvent } from "../gameevents.js";

const maps01 = JSON.parse(
  fs.readFileSync(path.join(__dirname, "mocks/map01-model-two-rooms.json"))
);

const maps02 = JSON.parse(
  fs.readFileSync(path.join(__dirname, "mocks/map02.json"))
);

// Note: this set of logs were made using mocks/map02.json
const singlePlayer2MoveEthLogs = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "mocks/single-player-two-move-ethlogs.json")
  )
);

const { map01, map01badroomcorridor } = maps01;
const { map02 } = maps02;

describe("SceneCatalog", function () {
  it("Should create an empty catalog", async function () {
    const scat = new SceneCatalog();
  });
  it("Should load two rooms", async function () {
    const scat = new SceneCatalog();
    scat.load(map01);
  });
  it("Should raise exception loading two rooms", async function () {
    const scat = new SceneCatalog();
    expect(() => {
      scat.load(map01badroomcorridor);
    }).toThrow("issues with room 1: [[0,0]]");
  });

  it("Should create and resolve token for first move", async function () {
    const scat = new SceneCatalog();
    scat.load(map01);

    // Create the token with full visibility of the map

    // resolve the token with full visibility of the map and only the state that can be resolved from the chain
  });

  it("Should create and resolve tokens for all moves", async function () {

    // Note that this test ignores location values recored in the events. It
    // simply covers the scheme by which we generate those values.
    const arena = arenaInterface();
    const r = new StateRoster(arena, ethers.BigNumber.from(11)); // 11 matches the mock data
    const scat = new SceneCatalog();
    scat.load(map01);

    const snap = r.snapshot();

    const startLocationID = 2;

    const locations = {};
    const playerLocations = {};

    for (const ethlog of singlePlayer2MoveEthLogs) {
      const event = parseEventLog(arena, ethlog);
      const addr = playerFromParsedEvent(event);
      if (typeof addr === "undefined") {
        r.applyParsedEvent(event);
        r.processOne(undefined, addr);
        continue;
      }

      r.applyParsedEvent(event);
      const before = snap.current(addr);
      const currentLocationEID =
        typeof before.lastEID !== "undefined" ? before.lastEID : 0;
      const [p, delta] = r.processOne(before, addr);

      if (delta.registered === true) {
        const token = scenetoken(
          p.address,
          startLocationID,
          currentLocationEID,
          scat.hashAlpha
        );
        playerLocations[p.address] = [token, startLocationID];
        locations[token] = startLocationID;
      }

      if (event.event !== ABIName.UseExit) continue;

      var found = undefined;

      // Check we can derive the location cold - this requires searching all the pre-images
      for (var i = 0; i < map02.model.rooms.length; i++) {
        const derived = scenetoken(p.address, i, currentLocationEID, scat.hashAlpha);
        const [current, location] = playerLocations[p.address]; // if this breaks the mock data needs re-generating
        if (derived === current) {
          expect(location).toEqual(i);
          found = [derived, i];
          continue;
        }
      }
      expect(found).toBeDefined();

      // Check we can derive the next location by searching the locations
      // reachable from the previous, IF we have the map

      // take the location recorded for the player as the 'last' location, and
      // see if we can derive a token to match the one implied by the room
      // reached by the UseExit
      const [lastToken, lastLocation] = playerLocations[p.address];
      const nextLocation = targetRoom(
        map02.model,
        lastLocation,
        event.args.exitUse.side,
        event.args.exitUse.egressIndex
      );
      // the token that will map to the target room's location
      const nextToken = scenetoken(
        p.address,
        nextLocation,
        event.args.eid,
        scat.hashAlpha
      );

      found = undefined;
      for (const i of connectedRooms(map02.model, lastLocation)) {
        const derived = scenetoken(
          p.address,
          i,
          event.args.eid,
          scat.hashAlpha
        );
        if (derived != nextToken) continue;
        found = [nextToken, i];
        locations[derived] = i;
        playerLocations[p.address] = [nextToken, nextLocation];
      }
      expect(found).toBeDefined();
    }
  });
});
