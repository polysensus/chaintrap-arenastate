import { getGameCreated } from "./arenaevent.js";
import { ArenaEvent } from "./arenaevent.js";
import { EventParser } from "./chainkit/eventparser.js";
import { Minter } from "./minter.js";
import { TransactRequest } from "./chainkit/transactor.js";

export class Guardian {
  constructor(arena, options) {
    this.init(arena, options);
  }

  init(arena, options) {
    if (arena) this.arena = arena;
    if (options) this.initialOptions = { ...options };

    this.eventParser = new EventParser(this.arena, ArenaEvent.fromParsedEvent);
    this.minter = new Minter(this.arena, this.initialOptions);
    this.lastMintedGID = undefined;
    this._preparingDungeon = false;
    this._dungeonPrepared = false;
    this._lastMinted = undefined;
  }

  prepareDungeon(collection, options) {
    this._dungeonPrepared = false;
    this.minter.loadMap(collection, options);
    this._preparingDungeon = true;
  }

  finalizeDungeon() {
    if (!this._preparingDungeon) throw new Error(`nothing to finalize`);
    this._preparingDungeon = false; // if the commit fails, you need to start all over
    this.minter.commitTopology();
    this._dungeonPrepared = true;
  }

  async mintGame(options) {
    if (!this._dungeonPrepared) throw new Error("dungeon not prepared");
    this.minter.applyOptions(options);
    const r = await this.minter.mint();
    const collector = new TransactRequest(this.eventParser);
    const result = collector
      .requireLogs(
        "TransferSingle(address,address,address,uint256,uint256)",
        // Only sets one root
        "TranscriptMerkleRootSet(uint256,bytes32,bytes32)",
        "TranscriptCreated(uint256,address,uint256)"
      )
      .acceptLogs("URI(string,uint256)")
      .collect(r);

    const created = result.eventByName("TranscriptCreated");

    this._lastMinted = {
      gid: created.gid,
      creator: created.parsedLog.args.creator,
      registrationLimit: created.parsedLog.args.registrationLimit,
    };
    return result;
  }
  lastMinted() {
    return { ...this._lastMinted };
  }
}
