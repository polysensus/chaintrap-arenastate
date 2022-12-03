import { ethers } from "ethers";

export class PlayerState {
  // constructor () { }

  toObject() {
    const o = {};
    if (typeof this.registered !== "undefined") o.registered = this.registered;
    if (typeof this.address !== "undefined") o.address = this.address;
    if (typeof this.profile !== "undefined") o.profile = this.profile;
    if (typeof this.location !== "undefined") o.location = this.location;
    if (typeof this.locationIngress !== "undefined")
      o.locationIngress = this.locationIngress;
    if (typeof this.startLocation !== "undefined")
      o.startLocation = this.startLocation;
    if (typeof this.sceneblob !== "undefined") o.sceneblob = this.sceneblob;
    if (typeof this.halted !== "undefined") o.halted = this.halted;
    if (typeof this.pendingExitUsed !== "undefined")
      o.pendingExitUsed = this.pendingExitUsed;
    if (typeof this.lastEID !== "undefined") o.lastEID = this.lastEID;
    return o;
  }

  clone() {
    const c = new PlayerState();
    c.update(this.toObject());
    return c;
  }

  diff(other) {
    const delta = {};

    if (this.registered !== other.registered) {
      delta.registered = !!other.registered;
    }

    if (this.address !== other.address) {
      delta.address = other.address;
    }

    if (this.profile !== other.profile) {
      delta.profile = other.profile;
    }

    if (this.halted !== other.halted) {
      delta.halted = !!other.halted;
    }

    if (this.pendingExitUsed !== other.pendingExitUsed) {
      delta.pendingExitUsed = !!other.pendingExitUsed;
    }

    if (this.startLocation !== other.startLocation) {
      delta.startLocation = other.startLocation;
    }

    if (this.location !== other.location) {
      delta.location = other.location;
    }

    if (this.locationIngress !== other.locationIngress) {
      delta.locationIngress = other.locationIngress;
    }

    if (this.sceneblob !== other.sceneblob) {
      delta.sceneblob = other.sceneblob;
      delta.locationIngress = other.locationIngress;
    }

    if (this.lastEID !== other.lastEID) {
      delta.lastEID = other.lastEID;
    }
    return delta;
  }

  // @ts-ignore
  update({
    registered,
    address,
    profile,
    location,
    locationIngress,
    startLocation,
    sceneblob,
    halted,
    pendingExitUsed,
    lastEID,
  } = {}) {
    if (typeof registered !== "undefined") {
      this.registered = registered;
    }

    if (typeof address !== "undefined") {
      this.address = address;
    }

    if (ethers.utils.isBytesLike(profile)) {
      if (ethers.utils.stripZeros(profile).length === 0) {
        profile = undefined;
      }
      this.profile = profile;
    } else if (typeof profile !== "undefined") {
      this.profile = profile;
    }

    if (typeof location !== "undefined") {
      this.location = location;
    }

    if (typeof locationIngress !== "undefined") {
      this.locationIngress = locationIngress;
    }

    if (ethers.utils.isBytesLike(startLocation)) {
      if (ethers.utils.stripZeros(startLocation).length === 0) {
        startLocation = undefined;
      }
    }

    if (typeof startLocation !== "undefined") {
      this.startLocation = startLocation;
    }

    if (typeof sceneblob !== "undefined") {
      this.sceneblob = sceneblob;
    }

    if (typeof halted !== "undefined") {
      this.halted = halted;
    }

    if (typeof halted !== "undefined") {
      this.halted = halted;
    }

    if (typeof pendingExitUsed !== "undefined") {
      this.pendingExitUsed = pendingExitUsed;
    }

    if (typeof lastEID !== "undefined") {
      this.lastEID = lastEID;
    }
    return this;
  }
}
