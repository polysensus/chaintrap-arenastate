import { ethers } from "ethers";
import { describe, it, expect } from "vitest";

import { ABIName } from "./abiconst.js";
import { Player } from "./player.js";
// import msgpack from "@msgpack/msgpack";

const arrayify = ethers.utils.arrayify;

describe("Player", function () {
  it("Should create empty player", async function () {
    const p = new Player();
    expect(p.address).to.equal(undefined);
    // expect(ss._scene.a).to.equal(2);
  });
  it("Should set the registered state", async function () {
    const p = new Player();
    p.setState({ registered: true });
    expect(p.state.registered).to.equal(true);
  });

  it("Should return correct snapshot", async function () {
    const p = new Player();
    p.setState({
      registered: true,
      address: "0x01",
      location: arrayify("0x02"),
      startLocation: arrayify("0x03"),
      sceneblob: arrayify("0x04"),
      halted: false,
    });
    const before = p.stateSnapshot();
    expect(before.registered).toBe(true);
    expect(before.address).toStrictEqual("0x01");
    expect(before.location).toStrictEqual(arrayify("0x02"));
    expect(before.startLocation).toStrictEqual(arrayify("0x03"));
    expect(before.sceneblob).toStrictEqual(arrayify("0x04"));
    expect(before.halted).toBe(false);
  });

  it("Should return empty delta", async function () {
    const p = new Player();

    const orig = {
      registered: true,
      address: "0x01",
      location: arrayify("0x02"),
      startLocation: arrayify("0x03"),
      sceneblob: arrayify("0x04"),
      halted: false,
    };
    p.setState(orig);

    const delta = p.stateDelta(p.stateSnapshot(), p.stateSnapshot());
    expect(delta.toObject()).toStrictEqual({});
  });

  it("Should return new location immediately", async function () {
    const p = new Player();

    const orig = {
      registered: true,
      address: "0x01",
      location: arrayify("0x02"),
      locationIngress: [1, 2],
      startLocation: arrayify("0x03"),
      sceneblob: arrayify("0x04"),
      halted: false,
    };
    p.setState(orig);

    const useExit = {
      event: ABIName.UseExit,
      transactionHash: "0xf1",
      args: {
        eid: 1,
      },
    };

    const exitUsed = {
      event: ABIName.ExitUsed,
      transactionHash: "0xf2",
      args: {
        eid: 1, // ExitUsed is from the host, confirming the players declared UseExit. So it has the same transcript entry eid
        outcome: {
          location: arrayify("0x0202"),
          sceneblob: arrayify("0x0404"),
          side: 2,
          ingressIndex: 1,
        },
      },
    };

    // Test that the paired events of UseExit (from the player) and ExitUsed
    // (from the game host) produce the expected state delta.  Notice that the
    // transcript entry id (eid) is the same for the player and the game host.
    // The player declares the move and the game host responds.
    let delta = p.applyEvent(useExit);
    expect(delta.lastEID).toBe(1);
    delete delta.lastEID;
    expect(delta.pendingExitUsed).toBe(true);
    delete delta.pendingExitUsed;
    expect(delta.toObject()).toStrictEqual({});

    delta = p.applyEvent(exitUsed);
    expect(delta.location).toStrictEqual(arrayify("0x0202"));
    expect(delta.sceneblob).toStrictEqual(arrayify("0x0404"));
    expect(delta.locationIngress).toStrictEqual([2, 1]);
    delete delta.location;
    delete delta.locationIngress;
    delete delta.sceneblob;
    expect(delta.pendingExitUsed).toBe(false);
    delete delta.pendingExitUsed;
    expect(delta.toObject()).toStrictEqual({});
  });
});
