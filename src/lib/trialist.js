import * as msgpack from "@msgpack/msgpack";
import { ArenaEvent } from "./arenaevent.js";
import { EventParser } from "./chainkit/eventparser.js";
import { TransactRequest } from "./chainkit/transactor.js";

export class Trialist {
  constructor(arena, options) {
    this.init(arena, options);
  }

  init(arena, options) {
    if (arena) this.arena = arena;
    if (options) this.initialOptions = { ...options };

    this.eventParser = new EventParser(this.arena, ArenaEvent.fromParsedEvent);
    this._currentGame = undefined;
  }

  async joinGame(gid, options) {
    let profile = options?.profile;
    if (!profile) profile = { nickname: options?.nickname ?? "<bashfulbob>" };

    const request = new TransactRequest(this.eventParser);
    request
      .method(this.arena.registerTrialist, gid, msgpack.encode(profile))
      .requireLogs("TranscriptRegistration(uint256,address,bytes)");

    const result = await request.transact();
    this._currentGame = gid;
    return result;
  }
}
