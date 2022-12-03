import { expect, describe, it } from "vitest";

// deps
import { ethers } from "ethers";

// app
import { StateRoster } from "./stateroster.js";

// shared testing

import { MockGame, MockDispatcher } from "../mocks/mocks.js";
import {
  playerJoined,
  playerStartLocation,
  useExit,
  defaultPlayer,
} from "../mocks/ethevents.js";

const bigOne = ethers.BigNumber.from(1);

describe("StateRoster", function () {
  it("Should create empty roster", async function () {
    const r = new StateRoster(undefined, ethers.BigNumber.from(1), undefined);
    expect(r.gid.eq(bigOne)).to.equal(true);
  });
  it("Should dispatch player registration imediately", async function () {
    const d = new MockDispatcher();

    const r = new StateRoster(undefined, bigOne);
    const snap = r.snapshot();
    r._playerJoined(playerJoined());
    r.dispatchChanges(snap, (...args) => d.dispatch(...args));

    // registered -> true, address -> 0x11...
    expect(d.results.length).to.equal(1);
    const [player, delta] = d.results[0];
    expect(delta.address).to.equal(defaultPlayer);
  });

  it("Should dispatch as batch", async function () {
    const d = new MockDispatcher();
    const g = new MockGame();

    const r = new StateRoster(g, bigOne);

    const events = [
      playerJoined({ tx: 1 }),
      playerStartLocation({ tx: 2 }),
      useExit({ tx: 3, eid: 1 }),
    ];
    const snap = r.snapshot();
    await r.load(events);
    r.dispatchChanges(snap, (...args) => d.dispatch(...args));
    // registered -> true, address -> 0x11...
    expect(d.results.length).to.equal(1);

    const [player, delta] = d.results[0];
    expect(delta.address).to.equal(defaultPlayer);
    // expect the player to be pending host confirmation
    expect(r.players[defaultPlayer].state.pendingExitUsed).to.equal(true);
  });
});
