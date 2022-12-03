export class MockDispatcher {
  constructor() {
    this.results = [];
  }

  dispatch(player, changed, value) {
    this.results.push([player, changed, value]);
  }
}

export class MockInterface {
  parseLog(log) {
    return log;
  }
}

export class MockArena {
  constructor() {
    this.interface = new MockInterface();
  }
}

export class MockGame {
  constructor() {
    this.arena = new MockArena();
  }
}
