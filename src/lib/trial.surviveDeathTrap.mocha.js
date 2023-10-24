// @ts-check
import { expect, use as chaiUse } from "chai";
// import * as chaiAsPromised from "chai-as-promised";
// chaiUse(chaiAsPromised);

import { ethers } from "ethers";

import { Guardian } from "./guardian.js";
import { Trialist } from "./trialist.js";
import { ArenaEvent } from "./arenaevent.js";
import { EventParser } from "./chainkit/eventparser.js";

//
import maps from "../../data/maps/map02.json" assert { type: "json" };
import { readBinaryData } from "../commands/data.js";

import furnishings from "../../data/maps/map02-furnishings.json" assert { type: "json" };
import { Dispatcher } from "./chainkit/dispatcher.js";

const defaultMaxWait = 4000;
const defaultInterval = 500;

describe("Game session participant ChestTreatGainLife", function () {
  it("Should show participant surviving death treap", async function () {
    if (!this.gameOptions) {
      this.skip();
    }

    const pollingInterval = this.ethersPollingInterval;

    const eventParser = new EventParser(
      this.guardianArena,
      ArenaEvent.fromParsedEvent
    );
    const dispatcher = new Dispatcher(eventParser);
    const guardian = new Guardian(eventParser, {
      ...this.gameOptions,
      noMETADATA: true,
      dispatcher,
    });

    guardian.prepareDungeon(maps["map02"]);
    guardian.furnishDungeon(furnishings);
    guardian.finalizeDungeon();

    const gameIconBytes = readBinaryData("gameicons/game-ico-1.png");
    const gid = (
      await guardian.mintGame({
        gameIconBytes,
        fetch,
      })
    ).gid;
    const gidHex = gid.toHexString();
    await guardian.preparedStartListening(gid);

    const trialist = new Trialist(eventParser, { dispatcher });

    await trialist.joinGame(gid, { nickname: "user1" });

    // Note: we need to do the additional waits because waiting for the
    // transaction to confirm is not sufficient to ensure the emitted logs are
    // seen by the respective providers.

    await guardian.journal?.waitForNumParticipants(gid, 1, {
      interval: pollingInterval,
      logBanner: "guardian: ",
    });
    await guardian.startGame(gid, [0]); // start at location 0

    await trialist.startListening(gid);
    await trialist.journal?.waitForNumParticipants(gid, 1, {
      interval: pollingInterval,
      logBanner: "trialist: ",
    });

    // First, open the chest with the life bonus. its the second chest in the room hence input index 5
    await trialist.commitLocationChoice(gid, 4, 1); // -> open_chest (second at location 0)

    await guardian.journal?.waitPendingOutcomes(gid, 1, {
      interval: pollingInterval,
      logBanner: "guardian: ",
    });
    let resolved = await guardian.resolvePending(gid);
    expect(resolved.length).to.equal(1);
    await guardian.journal?.waitOutcomeResolutions(gid, resolved);

    // Now open the fatal trap

    await trialist.commitLocationChoice(gid, 4, 0); // -> open_chest (first at location 0)

    await guardian.journal?.waitPendingOutcomes(gid, 1, {
      interval: pollingInterval,
      logBanner: "guardian: ",
    });
    resolved = await guardian.resolvePending(gid);
    expect(resolved.length).to.equal(1);
    await guardian.journal?.waitOutcomeResolutions(gid, resolved);

    await trialist.journal?.waitOutcomeResolutions(gid);

    // Check that the participant can continue
    await trialist.commitLocationChoice(gid, 1, 0); // -> location 8

    await guardian.journal?.waitPendingOutcomes(gid, 1, {
      pollingInterval,
      logBanner: "guardian: ",
    });
    resolved = await guardian.resolvePending(gid);
    expect(resolved.length).to.equal(1);
  });
});
