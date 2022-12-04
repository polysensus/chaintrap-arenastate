import { ethers } from "ethers";
import * as msgpack from "@msgpack/msgpack";
import { getLogger } from "./log.js";
import { isUndefined } from "./idioms.js";

const log = getLogger("playerprofile");
const arrayify = ethers.utils.arrayify;

export class PlayerProfile {
  constructor(profile) {
    this.update(profile);
  }

  value() {
    return { nickname: this.nickname, character: this.character };
  }

  setNickname(nickname) {
    return this.update({ nickname });
  }

  update(profile) {
    if (isUndefined(profile)) return this.value();

    const { nickname, character } = profile;
    if (nickname) this.nickname = nickname;
    if (character) this.character = character;
    return this.value();
  }

  decode(data) {
    // @ts-ignore
    log.debug("decode", data, JSON.stringify(data), typeof data);
    return this.update(msgpack.decode(arrayify(data)));
  }

  encode() {
    return msgpack.encode(this.value());
  }
}
