// @ts-check

import { Guardian } from "./guardian.js";
import { ArenaEvent } from "./arenaevent.js";
import { EventParser } from "./chainkit/eventparser.js";

import furnishings from "../../data/maps/map02-furnishings.json" assert { type: "json" };

//
import maps from "../../data/maps/map02.json" assert { type: "json" };

import { readBinaryData } from "../commands/data.js";

describe("Guardian mintGame tests", function () {
  it("Should mint a game", async function () {
    if (!this.gameOptions) {
      this.skip();
    }
    const eventParser = new EventParser(
      this.guardianArena,
      ArenaEvent.fromParsedEvent
    );
    const guardian = new Guardian(eventParser, this.gameOptions);

    guardian.prepareDungeon(maps["map02"]);
    guardian.furnishDungeon(furnishings);
    guardian.finalizeDungeon();
    const gameIconBytes = readBinaryData("gameicons/game-ico-1.png");
    // XXX: TODO createGame
    // await guardian.mintGame({ gameIconBytes, fetch });
  });
});
