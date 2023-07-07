// @ts-check
import { expect } from "chai";
import { ethers } from "ethers";

import { Guardian } from "./guardian.js";
import { ArenaEvent } from "./arenaevent.js";
import { EventParser } from "./chainkit/eventparser.js";
import { ObjectType } from "./maptrie/objecttypes.js";

//
import maps from "../../data/maps/map02.json" assert { type: "json" };
import furnishings from "../../data/maps/map02-furnishings.json" assert { type: "json" };

describe("Guardian furnish dungeon tests", function () {
  it("Should place finish", async function () {
    if (!this.gameOptions) {
      this.skip();
    }
    const eventParser = new EventParser(
      this.guardianArena,
      ArenaEvent.fromParsedEvent
    );
    const guardian = new Guardian(eventParser, this.gameOptions);
    guardian.prepareDungeon(maps, { mapName: "map02" });
    guardian.furnishDungeon(furnishings);
    guardian.finalizeDungeon();
    expect(guardian.topology).to.exist;
    expect(guardian.topology?.finishLocationId).to.equal(8);
    const finish = guardian.topology?.leaf(
      ObjectType.Finish,
      guardian.topology?.finishExitId
    );
    expect(finish.type).to.equal(ObjectType.Finish);

    const prepared = guardian.topology?.prepareLeaf(finish);
    const proof = guardian.topology?.trie?.getProof(prepared);
    expect(proof).to.exist;
  });
});
