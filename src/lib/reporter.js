export class Reporter {
  static fromVerbosity(verbosity) {
    // silent mode is explicit verbosity < 0
    if (verbosity <= 0) return new Reporter();

    // enable normal output
    const outputs = [console.log];

    if (verbosity) {
      // enabled info output
      outputs.push(console.log);

      if (verbosity > 1)
        // enabled debug output
        outputs.push(console.log);
    }
    return new Reporter(...outputs);
  }

  constructor(output, info, debug) {
    this._output = output;
    this._info = info;
    this._debug = debug;
  }
  out(msg) {
    if (!this._output) return;
    this._output(msg);
  }
  info(msg) {
    if (!this._info) return;
    this._info(msg);
  }
  debug(msg) {
    if (!this._debug) return;
    this._debug(msg);
  }
}
