/**
 * Access defines an ingress or egress as a triple of location, side and exit index.
 * Used in the context of the identified location. A location has four sides.
 * And each side is defined by a list of exits. The exit index identifies which,
 * the value at that index identifies a map join (aka corridor)
 */
export class Access {
  /**
   * @template {location: number, side: number, exit: number} AccessLike
   * @param {AccessLike} access
   */
  constructor(access) {
    this.location = access.location;
    this.side = access.side;
    this.exit = access.exit;
  }
}
