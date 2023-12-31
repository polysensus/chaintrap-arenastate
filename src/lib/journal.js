import { ethers } from "ethers";
import { ABIName } from "./abiconst.js";
import { StateRoster } from "./stateroster.js";
import { Dispatcher } from "./chainkit/dispatcher.js";
import { TransactionHorizon } from "./chainkit/transactionhorizon.js";
import {
  findGameEvents,
  findRootLabels,
  findTransferEvents,
  logCompare,
} from "./arenaevent.js";
import { getLogger } from "./log.js";
import { TRANSCRIPT_EVENT_NAMES, transcriptEventSig } from "./arenaabi.js";
import { conditionInput } from "./maptrie/objects.js";
import { sleep } from "./processutils.js";
import { awaitable } from "./idioms.js";

const log = getLogger("journal");
/**
 * The default maximum number of games the journal will monitor. This directly
 * impacts the size of a log topic filter.
 */
const defaultJournalMax = 5;
const defaultBlockHorizon = 30;
const defaultMaxWait = 4000;
const defaultWaitInterval = 500;

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

    // gids that startListening has been called for
    this.listening = {};

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

    this.updateCallback = options?.updated;

    // The journal will track at most this many game transcripts
    if (!options.maxTranscripts) options.maxTranscripts = defaultJournalMax;
    if (!options.blockHorizon) options.blockHorizon = defaultBlockHorizon;
    if (!options.defaultMaxWait) options.defaultMaxWait = defaultMaxWait;
    if (!options.defaultWaitInterval)
      options.defaultWaitInterval = defaultWaitInterval;

    if (Object.keys(this.transcripts).length > options.maxTranscripts)
      throw new Error(`can't reduce maxTranscripts below count of existing`);
    this.options = options;
  }

  handlerKey(name, gidHex) {
    return `${name}-#Journal-${gidHex}`;
  }

  getStateRoster(gid) {
    const gidHex = gid.toHexString();
    const roster = this.transcripts[gidHex];
    if (!roster)
      throw new Error(`Journal# TranscriptRegistration unknown gid ${gidHex}`);
    return roster;
  }

  _handle(event, key) {
    if (event.name !== ABIName.TransferBatch) {
      this._handleTranscriptEvent(event, key);
      return;
    }
    // Then it might be for *multiple* game sessions
    for (const id of event.parsedLog.args.ids) {
      const gidHex = id.toHexString();
      if (!this.transcripts[gidHex]) {
        log.debug(`TransferBatch gid ${gidHex} not excluded from the journal`);
        continue;
      }
      event.gid = id;
      this._handleTranscriptEvent(event, key);
    }
  }

  _handleTranscriptEvent(event, key) {
    // log.info(`***** handling ${event.name} ${event.subject} ${key}`);
    // ethers listeners can't guarantee no duplicates. and also this handler is
    // called both from ethers and directly by this class when the transcripts
    // are initially opened. We don't de-dupe in the dispatcher because it
    // supports one -> many filter handling
    if (this.horizon.known(event)) return;

    if (event.name === "TranscriptRegistration")
      log.debug(`registering participant ${event.subject}`);

    const gidHex = event.gid.toHexString();
    if (!this.transcripts[gidHex])
      throw new Error(`Journal# TranscriptRegistration unknown gid ${gidHex}`);

    const roster = this.transcripts[gidHex];
    roster.applyEvent(event);

    if (!this.updateCallback) return;
    // To process the participant specific events (TransferSingle and TransferBatch) an updateCallback must be provided.
    if (event.name === "TranscriptRegistration")
      this._updateParticipantListeners(event.gid, event.subject);

    const state = roster.trialists[event.subject]?.current();

    if (awaitable(this.updateCallback)) {
      this.updateCallback(event.gid, event.eid, key, event, state).catch(
        (err) => {
          log.info(
            `journal.js:Journal# updateCallback err ${err} ${key} ${event?.eid}`
          );
        }
      );
    } else {
      try {
        this.updateCallback(event.gid, event.eid, key, event, state);
      } catch (err) {
        log.info(`journal.js:Journal# updateCallback err ${err} ${key} ${eid}`);
      }
    }
  }

  /**
   * Ensure the listeners that are specific to participant addresses.
   */
  _updateParticipantListeners(gid, subject) {
    const gidHex = gid.toHexString();
    if (!this.transcripts[gidHex])
      throw new Error(
        `Journal# _updateParticipantListeners unknown gid ${gidHex}`
      );

    const callback = this._handle.bind(this);

    const participants = Object.keys(this.transcripts[gidHex].trialists);

    const listenIDs = [];
    // Listener for a TransferBatch that targets any of the participants.
    let eventABIName = ABIName.TransferBatch;
    let keyTo = `${this.handlerKey(eventABIName, gidHex)}#to`;
    let keyFrom = `${this.handlerKey(eventABIName, gidHex)}#from`;

    // Remove any current handlers
    this.dispatcher.removeHandler(keyTo);
    this.dispatcher.removeHandler(keyFrom);

    let sig = transcriptEventSig(eventABIName);
    // Create a handler matching a batch transfer TO any of the participants in the transcript
    // NOTICE: these cant filter on a specific git because they are batch transfer events
    let handler = this.dispatcher.createHandler(
      callback,
      sig,
      null,
      null,
      participants
    );
    this.dispatcher.addHandler(handler, keyTo);
    listenIDs.push(keyTo);
    // Create a handler matching a batch transfer FROM any of the participants in the transcript
    handler = this.dispatcher.createHandler(
      callback,
      sig,
      null,
      participants,
      null
    );
    this.dispatcher.addHandler(handler, keyFrom);
    listenIDs.push(keyFrom);

    // Now do the same for TransferSingle
    eventABIName = ABIName.TransferSingle;
    keyTo = `${this.handlerKey(eventABIName, gidHex)}#to`;
    keyFrom = `${this.handlerKey(eventABIName, gidHex)}#from`;

    // Remove any current handlers
    this.dispatcher.removeHandler(keyTo);
    this.dispatcher.removeHandler(keyFrom);

    sig = transcriptEventSig(eventABIName);
    // Create a handler matching a batch transfer TO any of the participants in the transcript
    // NOTICE: This time we can specify the gid as its a single token transfer
    handler = this.dispatcher.createHandler(
      callback,
      sig,
      null,
      null,
      participants
    );
    this.dispatcher.addHandler(handler, keyTo);
    listenIDs.push(keyTo);
    // Create a handler matching a batch transfer FROM any of the participants in the transcript
    handler = this.dispatcher.createHandler(
      callback,
      sig,
      null,
      participants,
      null
    );
    this.dispatcher.addHandler(handler, keyFrom);
    listenIDs.push(keyFrom);

    // Start the specific listeners we have changed or added
    for (const id of listenIDs) this.dispatcher.startListening(id);
  }

  /**
   * open transcript for the games
   * @param {number|ethers.BigNumber} game
   */
  openTranscript(gid, staticRootLabel, options) {
    const gidHex = gid.toHexString();

    if (this.transcripts[gidHex]) throw new Error(`gid ${gidHex} already open`);

    if (Object.keys(this.transcripts).length + 1 >= this.options.maxTranscripts)
      throw new Error(
        `this journal is configured to track ${this.options.maxTranscripts} transcripts at most.`
      );

    this.transcripts[gidHex] = new StateRoster(this.arena, {
      ...this.options,
      ...options,
    });
    this.staticRoots[gidHex] =
      ethers.utils.formatBytes32String(staticRootLabel);
  }

  locationChoiceArgs(gid, ...input) {
    return {
      rootLabel: this.staticRootLabel(gid),
      input: input.map(conditionInput),
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
   * @param {rootLabel?:string, maxTranscripts?:number} options
   * @param  {...ethers.BigNumber} gids to watch
   */
  async startListening(candidateGids, options) {
    // filter out any we are already watching
    const gids = [];
    for (const gid of candidateGids) {
      if (this.listening[gid.toHexString()]) continue;
      gids.push(gid);
    }

    for (const gid of gids) {
      const gidHex = gid.toHexString();
      const staticRoot = await this.findStaticRoot(gid, options);

      if (!this.transcripts[gidHex])
        this.openTranscript(gid, staticRoot.rootLabel, options);

      // Now that the roster instance exists, it is safe to start listening
      const callback = this._handle.bind(this);

      for (const name of TRANSCRIPT_EVENT_NAMES) {
        const sig = transcriptEventSig(name);

        // All transcript events can be filter on the game id as the first indexed topic
        const handler = this.dispatcher.createHandler(callback, sig, gid);

        this.dispatcher.addHandler(handler, this.handlerKey(name, gidHex));
      }
    }

    // do two passes so we don't get odd effects on exceptions interrupting the handler addition
    for (const gid of gids) this.listening[gid.toHexString()] = true;

    // rely on the horizon de-dupe to ensure we don't get duplicates due to the
    // listeners already being started.
    for (const gid of gids) {
      const gidHex = gid.toHexString();
      for (const ethersLog of await findGameEvents(this.arena, gid, 0)) {
        const event = this.eventParser.parse(ethersLog);
        if (!event) {
          log.info(`failed to parse ${JSON.stringify(ethersLog)}`);
          continue;
        }
        this._handle(event, this.handlerKey(event.name, gidHex));
      }
    }
    // Start all the listeners (idempotent)
    this.dispatcher.startListening();
  }

  /**
   * Stop all listeners associated with the listed gids
   *
   * If gids is undefined (or omitted), stop all current listeners.
   * @param {undefined|ethers.BigNumber[]} gids
   */
  stopListening(gids = undefined) {
    let gidsHex = [];
    if (typeof gids === undefined)
      for (const gidHex of Object.keys(this.listening)) gidsHex.push(gidHex);
    else for (const gid of gids) gidsHex.push(gid.toHexString());

    for (const gidHex of gidsHex) {
      if (!this.listening[gidHex]) continue;

      for (const name of TRANSCRIPT_EVENT_NAMES) {
        const id = this.handlerKey(name, gidHex);
        this.dispatcher.removeHandler(id);
      }

      // remember to remove the handlers for the transfer events
      for (const name of [ABIName.TransferBatch, ABIName.TransferSingle]) {
        let id = `${this.handlerKey(name, gidHex)}#to`;
        this.dispatcher.removeHandler(id);
        id = `${this.handlerKey(name, gidHex)}#from`;
        this.dispatcher.removeHandler(id);
      }

      delete this.listening[gidHex];
    }
  }

  pendingOutcomes(gid) {
    return this.transcripts[gid.toHexString()].pendingOutcomes();
  }

  _waitOptions(options) {
    const maxWait = options?.maxWait ?? this.options.defaultMaxWait;
    const interval = options?.interval ?? this.options.defaultWaitInterval;
    const logBanner = options?.logBanner ?? "";

    return { maxWait, interval, logBanner };
  }

  async waitForNumParticipants(gid, num, options = {}) {
    let { maxWait, interval, logBanner } = this._waitOptions(options);

    const gidHex = gid.toHexString();
    let count = this?.transcripts?.[gidHex]?.count;

    while ((count ?? 0) < num) {
      if (maxWait < 0) throw Error(`maxWait ${maxWait} expired`);

      console.log(
        `${logBanner}waiting for ${num - count} participants [${interval}ms]`
      );
      await sleep(interval);
      count = this?.transcripts?.[gidHex]?.count;
      maxWait -= interval;
    }
  }

  /** wait for a specific number of trialists to enter the outcome pending state */
  async waitPendingOutcomes(gid, num, options = {}) {
    let { maxWait, interval, logBanner } = this._waitOptions(options);

    const gidHex = gid.toHexString();

    const transcript = this?.transcripts?.[gidHex];
    if (!transcript) throw new Error(`transcript not ready for ${gidHex}`);

    let count = [...transcript.pendingOutcomes()].length ?? 0;

    while (count < num) {
      if (maxWait < 0) throw Error(`maxWait ${maxWait} expired`);

      console.log(
        `${logBanner}waiting for ${
          num - count
        } pending outcomes [${interval}ms]`
      );
      await sleep(interval);
      maxWait -= interval;
      count = [...transcript.pendingOutcomes()].length ?? 0;
    }
  }

  /** wait for a specific set of trialists to have any outstanding outcome resolved */
  async waitOutcomeResolutions(gid, trialistAddresses, options = {}) {
    let { maxWait, interval, logBanner } = this._waitOptions(options);

    const gidHex = gid.toHexString();

    const transcript = this?.transcripts?.[gidHex];
    if (!transcript) throw new Error(`transcript not ready for ${gidHex}`);

    const resolving = {};

    if (typeof trialistAddresses === "undefined") {
      for (const t of Object.values(transcript.trialists))
        resolving[t.address] = t;
    } else {
      for (const addr of trialistAddresses) {
        if (!(addr in transcript.trialists))
          throw new Error(
            `No transcript present in journal for address ${addr}`
          );
        resolving[addr] = transcript.trialists[addr];
      }
    }

    while (true) {
      let pending = {};

      // get every pending outcome that is currently being considered for resolution
      for (const t of transcript.pendingOutcomes()) {
        if (!(t.address in resolving)) continue;
        pending[t.address] = t;
      }

      // if an address to resolve was not found, it is resolved
      for (const addr of Object.keys(resolving))
        if (!(addr in pending)) delete resolving[addr];

      const count = Object.keys(resolving).length;
      if (count === 0) break;

      maxWait -= interval;
      if (maxWait < 0) throw Error(`maxWait ${maxWait} expired`);

      console.log(
        `${logBanner}waiting for ${count} outcome resolutions [${interval}ms]`
      );
      await sleep(interval);
    }
  }
}
