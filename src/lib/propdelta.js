
/**
 * This class provides simple property delta tracking. Intended to be used for
 * event update de-duplication
 */
export class PropDelta {
  /**
   * @constructor
   * @param {[...string]} props - the names of the properties to be
   * considered. any objects properties not  in variables are ignored.
   * @param {string:function} conditioners = maps property names to conditioning
   * functions, typically these normalize the values. it is not necessary to
   * provide these unless special handling is particularly needed.
   */
  constructor(props, conditioners) {
    this.props = [...props];
    this.conditioners = {...conditioners};
  }

  conditionValue(name, value) {
    const conditioner = this.conditioners[name];
    if (!conditioner) return value;
    return conditioner(value);
  }

  /**
   * Return the delta from source to other, such that
   *  source + delta == source + other
   * 
   * But only the changed values are present in delta
   * 
   * @param {object} source
   * @param {object} other
   */
  delta(source, other) {
    const delta = {};

    for (const prop of this.props) {
      const value = this.conditionValue(prop, other[prop]);
      if (typeof value === "undefined") {
        if (prop in source && typeof source[prop] !== "undefined")
          delta[prop] = value;
        continue;
      }
      if (typeof source[prop] !== value)
        delta[prop] = other[prop];
    }
    return delta;
  }

  /**
   *
   * @param {object} target
   * @param {object} update
   * @returns
   */
  static update(target, update) {
    for (const prop of this.props) {
      const value = this.conditionValue(prop, update[prop]);
      if (typeof value !== "undefined") target[prop] = value;
    }
    return target;
  }

}