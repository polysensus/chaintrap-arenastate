/**
 * isUndefined performs ths safe and idiomatic check for an object or scalar being undefined
 * @param {object} value any object or scalar
 * @returns {boolean}
 */
export function isUndefined(value) {
  return typeof value === "undefined";
}

/** isAsync checks if the value is an async function */
export function isAsync(value) {
  return value?.constructor?.name === "AsyncFunction";
}

/** isPromise checks if the value is a promise */
export function isPromise(value) {
  if (typeof value === "object" && typeof value.then === "function") {
    return true;
  }
  return false;
}

export function etherrmsg(err) {
  if (!err.body) return `${err}`;
  try {
    const jerr = JSON.parse(err.body);
    return jerr.error?.message ?? `${err}`;
  } catch (err2) {
    return `${err}`;
  }
}
