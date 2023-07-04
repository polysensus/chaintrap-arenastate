// @ts-check
import { expect } from "chai";
import { ethers } from "ethers";

import { Guardian } from "./guardian.js";
import { Trialist } from "./trialist.js";
import { ArenaEvent } from "./arenaevent.js";
import { EventParser } from "./chainkit/eventparser.js";
import { ObjectType } from "./maptrie/objecttypes.js";

//
import maps from "../../data/maps/map02.json" assert { type: "json" };
import furnishings from "../../data/maps/map02-furnishings.json" assert { type: "json" };
import { Dispatcher } from "./chainkit/dispatcher.js";

const defaultMaxWait = 4000;
const defaultInterval = 500;

describe("Game session tests", function () {
  it("Should complete game in two moves", async function () {
    if (!this.gameOptions) {
      this.skip();
    }

    const pollingInterval = this.ethersPollingInterval;

    const eventParser = new EventParser(
      this.guardianArena,
      ArenaEvent.fromParsedEvent
    );
    const dispatcher = new Dispatcher(eventParser);
    const guardian = new Guardian(eventParser, {...this.gameOptions, dispatcher});
    guardian.prepareDungeon(maps, { mapName: "map02" });
    guardian.furnishDungeon(furnishings);
    guardian.finalizeDungeon();
    const gid = (await guardian.mintGame()).gid;
    const gidHex = gid.toHexString();
    await guardian.startListening(gid);

    const trialist = new Trialist(eventParser, {dispatcher});

    await trialist.joinGame(gid, {nickname: "user1"});

    // Note: we need to do the additional waits because waiting for the
    // transaction to confirm is not sufficient to ensure the emitted logs are
    // seen by the respective providers.

    await guardian.journal?.waitForNumParticipants(gid, 1, {interval: pollingInterval, logBanner: "guardian: "});
    await guardian.startGame(gid, [0]); // start at location 0

    await trialist.startListening(gid);
    await trialist.journal?.waitForNumParticipants(gid, 1, {interval: pollingInterval, logBanner: "trialist: "});
    await trialist.commitLocationChoice(gid, 1, 0); // -> location 8

    await guardian.journal?.waitPendingOutcomes(gid, 1, {interval: pollingInterval, logBanner: "guardian: "});
    let resolved = await guardian.resolvePending(gid);
    expect (resolved.length).to.equal(1);
    await guardian.journal?.waitOutcomeResolutions(gid, resolved)


    // we delay listing on the trialist to this point so that it is easier to
    // diagnose issues with basic transaction listener handling (above). Prior
    // to this point the guardian handlers are the only listeners on the
    // contract.
    await trialist.startListening(gid);
    await trialist.journal?.waitOutcomeResolutions(gid);
    await trialist.commitLocationChoice(gid, 0, 0); // -> finish_exit


    await guardian.journal?.waitPendingOutcomes(gid, 1, {pollingInterval, logBanner: "guardian: "});
    resolved = await guardian.resolvePending(gid);
    expect (resolved.length).to.equal(1);

    // TODO: close the game on victory and transfer the transcript nft to the victor.

    // now commit to the victory choice

  });
});
