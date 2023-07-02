import { ethers } from "ethers";
import { asGid, gidEnsureType } from "./gid.js";
import { StateRoster } from "./stateroster.js";
import { Dispatcher } from "./chainkit/dispatcher.js";
import { TransactionHorizon } from "./chainkit/transactionhorizon.js";
import { findGameEvents, findRootLabels } from "./arenaevent.js";
import { getLogger } from "./log.js";
import { TRANSCRIPT_EVENT_NAMES, transcriptEventSig } from "./arenaabi.js";
import { conditionInput } from "./maptrie/objects.js";

const log = getLogger("journal");
/**
 * The default maximum number of games the journal will monitor. This directly
 * impacts the size of a log topic filter.
 */
const defaultJournalMax = 5;

const defaultBlockHorizon = 30;

export class Journal {
  constructor(eventParser, options) {
    this.initialOptions = { ...options };

    this._init(eventParser, options);
  }

  _init(eventParser, options) {
    this.eventParser = eventParser;
    this.arena = eventParser.contract;
    // For each game a StateRoster instance records the transcript for each
    // registered participant.
    this.staticRoots = {};
    this.transcripts = {};

    // note: updateOptions refers to transcripts so must be after they are defined above
    this.updateOptions(options);

    this.dispatcher =
      options?.dispatcher ??
      new Dispatcher(this.eventParser, { ...this.options });
    this.horizon = new TransactionHorizon(this.options.blockHorizon);
  }

  openedIDs() {
    return Object.keys(this.transcripts);
  }
  openedGids() {
    return this.openedIDs.map(ethers.BigNumber.from);
  }

  updateOptions(options) {
    options = { ...this.initialOptions, ...options };

    // The journal will track at most this many game transcripts
    if (!options.maxTranscripts) options.maxTranscripts = defaultJournalMax;

    if (!options.blockHorizon) options.blockHorizon = defaultBlockHorizon;

    if (Object.keys(this.transcripts).length > options.maxTranscripts)
      throw new Error(`can't reduce maxTranscripts below count of existing`);
    this.options = options;
  }

  handlerKey(name, gidHex) {
    return `${name}-#Journal-${gidHex}`;
  }

  _handle(event, key) {
    // ethers listeners can't guarantee no duplicates. and also this handler is
    // called both from ethers and directly by this class when the transcripts
    // are initially opened. We don't de-dupe in the dispatcher because it
    // supports one -> many filter handling
    if (this.horizon.known(event)) return;

    log.debug(`handling ${key}`);

    const gidHex = event.gid.toHexString();
    if (!this.transcripts[gidHex])
      throw new Error(`Journal# TranscriptRegistration unknown gid ${gidHex}`);

    this.transcripts[gidHex].applyEvent(event);
  }

  /**
   * open transcript for the games
   * @param {number|ethers.BigNumber} game
   */
  openTranscript(gid, staticRoot, options) {
    const gidHex = gid.toHexString();

    if (this.transcripts[gidHex]) throw new Error(`gid ${gidHex} already open`);

    this.transcripts[gidHex] = new StateRoster(this.arena, {
      ...this.options,
      ...options,
    });
    this.staticRoots[gidHex] = ethers.utils.formatBytes32String(staticRoot);

    // Now that the roster instance exists, it is safe to start listening
    const callback = this._handle.bind(this);

    for (const name of TRANSCRIPT_EVENT_NAMES) {
      const sig = transcriptEventSig(name);

      // All transcript events can be filter on the game id as the first indexed topic
      const handler = this.dispatcher.createHandler(callback, sig, gid);

      this.dispatcher.addHandler(handler, this.handlerKey(name, gidHex));
    }
  }

  locationChoiceArgs(gid, start, exit) {
    return {
      rootLabel: this.staticRootLabel(gid),
      input: [start, exit].map(conditionInput),
      data: "0x",
    };
  }

  staticRootLabel(gid) {
    const rootLabel = this.staticRoots[gid.toHexString()];
    if (!rootLabel)
      throw new Error(
        `not root label for ${gid.toHexString()}, transcript not open`
      );
    return rootLabel;
  }

  async findStaticRoot(gid, options) {
    let rootLabel = options?.rootLabel;

    const roots = {};

    for (const log of await findRootLabels(this.arena, gid)) {
      const parsed = this.eventParser.parse(log).parsedLog;
      roots[ethers.utils.parseBytes32String(parsed.args.label)] =
        ethers.utils.hexlify(parsed.args.root);
    }
    if (Object.keys(roots).length === 0)
      throw new Error(`no root labels found for id ${gid.toHexString()}`);
    if (Object.keys(roots).length != 1) {
      if (!rootLabel || !(rootLabel in roots))
        throw new Error(
          `more than one  rootLabel found, use --root-label to disambiguate`
        );
    } else rootLabel = Object.keys(roots)[0];
    const root = roots[rootLabel];
    return { rootLabel, root };
  }

  /**
   * open transcripts for the listed games, populates the initial roster state
   * and starts the listeners for future events.
   * @param {} options
   * @param  {...ethers.BigNumber} gids to watch
   */
  async startListening(candidateGids, options) {
    // filter out any we are already watching
    const gids = [];
    for (const gid of candidateGids) {
      if (this.transcripts[gid.toHexString()]) continue;
      gids.push(gid);
    }

    if (
      Object.keys(this.transcripts).length + gids.length >=
      this.options.maxTranscripts
    )
      throw new Error(
        `this journal is configured to track ${this.options.maxTranscripts} transcripts at most.`
      );

    for (const gid of gids) {
      const staticRoot = await this.findStaticRoot(gid, options);
      this.openTranscript(gid, staticRoot, options);
    }

    // Start all the listeners
    this.dispatcher.startListening();

    // rely on the horizon de-dupe to ensure we don't get duplicates due to the
    // listeners already being started.
    for (const gid of gids) {
      const gidHex = gid.toHexString();
      for (const log of await findGameEvents(this.arena, gid)) {
        const event = this.eventParser.parse(log);
        if (!event) continue;
        this._handle(event, this.handlerKey(event.name, gidHex));
      }
    }
  }

  pendingOutcomes(gid) {
    return this.transcripts[gid.toHexString()].pendingOutcomes();
  }
}
