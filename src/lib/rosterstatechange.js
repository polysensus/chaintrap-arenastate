/**
 * @typedef { import("./arenaevent.js").ArenaEvent } ArenaEvent
 */
export class RosterStateChange {
  constructor() {
    this.players = {};
  }

  captureCurrentState(addresses, roster) {
    this.players = {};

    for (const state of roster.currentStates(addresses)) {
      this.players[addr] = state;
    }
  }

  eventStateUpdate(event, roster, options) {
    const before = this.players[event.subject];
    if (!before) before = new TrialistState();

    const p = roster.players[event.subject];
    if (!p && event.name !== ABIName.TranscriptRegistration)
      throw new Error(`subject ${event.subject} not registered`);
    p.processPending(p.lastEID);

    return { state: p.state.toObject(), delta: before.diff(p.state) };
  }

  *currentChanges(addresses, roster, options) {
    if (!addresses) addresses = Object.keys(roster.players);

    for (const addr of addresses) {
      const before = this.players[addr]?.state ?? new TrialistState();
      const p = roster.players[addr];
      p.processPending(p.lastEID);
      yield {
        state: p.state.toObject(),
        delta: before.diff(p.state),
      };
    }
  }

  /*
  dispatchChanges(addresses, roster, dispatcher) {
    for (const update of this.currentChanges(addresses, roster)) {
      try {
        dispatcher(update.state, update.delta);
      } catch (e) {
        log.warn(
          `exception dispatching ${Object.keys(update.delta)} for p ${
            update.state.address
          }: ${e}`
        );
      }
    }
  }*/

  /**
   * Return the snapshot state for the player or return a blank state.
   * Use this to get the 'before' state for delta calculation
   * @param {address} addr
   * @returns
   */
  current(addr) {
    return this.players[addr]?.state ?? new TrialistState();
  }
}
