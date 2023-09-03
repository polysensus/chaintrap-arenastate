import * as msgpack from "@msgpack/msgpack";
import { TransactRequest } from "./chainkit/transactor.js";
import { Journal } from "./journal.js";

export class Trialist {
  constructor(eventParser, options) {
    this.init(eventParser, options);
  }

  init(eventParser, options) {
    if (eventParser) this.eventParser = eventParser;
    this.arena = this.eventParser.contract;

    if (options) this.initialOptions = { ...options };

    this.journal = new Journal(this.eventParser, options);
  }

  async joinGame(gid, options) {
    let profile = options?.profile;
    if (!profile) profile = { nickname: options?.nickname ?? "<bashfulbob>" };

    const request = new TransactRequest(this.eventParser, this.initialOptions);
    request
      .method(this.arena.registerTrialist, gid, msgpack.encode(profile))
      .requireLogs(
        "TranscriptRegistration(uint256,address,bytes)",
        "TranscriptParticipantLivesAdded(uint256,address,uint256,uint256)"
        );

    const result = await request.transact();
    return result;
  }

  async openTranscript(gid) {
    const staticRootLabel = (await this.journal.findStaticRoot(gid)).rootLabel;
    this.journal.openTranscript(gid, staticRootLabel);
  }

  async startListening(gid, options) {
    return await this.journal.startListening([gid], options);
  }

  async commitLocationChoice(gid, ...input) {
    const args = this.journal.locationChoiceArgs(gid, ...input);

    const request = new TransactRequest(this.eventParser);
    request
      .method(this.arena.transcriptEntryCommit, gid, args)
      .requireLogs(
        "TranscriptEntryCommitted(uint256,address,uint256,bytes32,uint256,bytes)"
      );

    const result = await request.transact();
    return result;
  }
}
