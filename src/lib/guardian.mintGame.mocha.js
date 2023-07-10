// @ts-check

import { Guardian } from "./guardian.js";
import { ArenaEvent } from "./arenaevent.js";
import { EventParser } from "./chainkit/eventparser.js";
import { getMap } from "./map/collection.js";

import furnishings from "../../data/maps/map02-furnishings.json" assert { type: "json" };

//
import maps from "../../data/maps/map02.json" assert { type: "json" };

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

    const { map, name } = getMap(maps, "map02");
    guardian.prepareDungeon(map, name);
    guardian.furnishDungeon(furnishings);
    guardian.finalizeDungeon();
    await guardian.mintGame();
  });
});
