import { ethers } from "ethers";

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { getMap } from "../map/collection.js";
import { Join } from "./join.js";
import { Access } from "./access.js";
import { Link } from "./link.js";
import { LocationChoices } from "./locationchoices.js";
import { LocationExit } from "./locationexit.js";
import { LocationLink } from "./locationlink.js";
import { ObjectCodec, LeafObject, leafHash } from "./objects.js";
import { deconditionInput } from "./objects.js";
import { ObjectType } from "./objecttypes.js";
import { LogicalRef, LogicalRefType } from "./logicalref.js";
import { Location } from "./location.js";

/**
 * LogicalTopology encodes a map as a merkle trie. Providing for contract
 * assertable existence proofs for locations and the logical connections between
 * them.
 *
 * @template {{location:number, side: number, exit: number}} AccessLike
 */
export class LogicalTopology {
  /**
   * @constructor
   */
  constructor() {
    /**
     * Each this.joins[i].joins is a pair of indices into this.locations
     * @type {Join[]}
     * @readonly
     */
    this.joins = [];

    /**
     * Each this.location[i].joins is a pair of indices into this.joins
     * @type {Location[]}
     * @readonly
     */
    this.locations = [];
    this.locations2 = [];

    /**
     * Each this.exitMenus[] encodes the choice of exits at each location.
     *
     * For each item, we get a leaf encoding: [SCENE-EXITS, [[side, exit], ..., ]]
     */
    this.exitMenus = [];
    this.exitMenuKeys = {};

    /**
     * For each item, we get a leaf encoding [LOCATION, [[l], [REF(#S)]]]
     * REF(#S) -> the key (hash) encoding of this.exitMenus[l]
     */
    this.locationChoices = [];
    this.locationChoicesKeys = {};

    /**
     * For each item, we get a leaf encoding [EXIT, [[REF(#S, i)], [REF(#L)]]]
     * REF(#S, i) -> the i'th input of the SCENE/exitMenu S
     * REF(#L) -> the key of location menu L
     */
    this.exits = [];
    this.exitKeys = {};
    // To encode location links we need to be able to reference by (location, side, exit) -> exit
    // `${location}:${side}:${exit}` -> exit
    this.locationExits = {};

    /**
     *
     * For each item, we get a leaf encoding [LINK, [[REF(#E)], [REF(#E')]]]
     * Represents directional connection between a pair of locations
     * REF(#E) -> exit E egress at location
     * REF(#E') -> exit E' ingress at location'
     */
    this.locationExitLinks = [];
    this.locationExitLinkKeys = {};

    /**
     * @readonly
     */
    this._committed = false;
  }

  _resetCommit() {
    this.exitMenus = [];
    this.exitMenuKeys = {};
    this.locationChoices = [];
    this.locationChoicesKeys = {};
    this.exits = [];
    this.exitKeys = {};
    this.locationExits = {};
    this.locationExitLinks = [];
    this.locationExitLinkKeys = {};

    this.locationChoicesx = [];
    this.locationChoiceKeysx = {};

    this._committed = false;
  }

  /**
   *
   * @param {object} mapCollection
   * @param {string|undefined} entryName
   */
  static fromCollectionJSON(mapCollection, entryName = undefined) {
    const { map, name } = getMap(mapCollection, entryName);
    const topo = new LogicalTopology();
    topo.extendJoins(map.model.corridors); // rooms 0,1 sides EAST, WEST
    topo.extendLocations(map.model.rooms);
    return topo;
  }

  /**
   * a list of objects describing the geometry of joins between pairs of locations
   * @template {{
   *  joins: [number, number],
   *  join_sides:[number, number]}|{joins: [number, number],
   *  sides:[number, number]}
   * } JoinLike
   * @param {JoinLike[]} joins - aka corridor
   */
  extendJoins(joins) {
    for (const join of joins) {
      const sides = join.sides ?? join.join_sides;
      if (!sides)
        throw new Error(
          "badly structured join object, has neither sides nor join_sides"
        );
      this.joins.push(new Join([...join.joins], [...sides]));
    }
  }

  /**
   * A list of objects describing the geometry of locations
   * @template {{joins:[number[], number[], number[], number[]], flags:Object.<string, boolean>}} LocationLike
   * @template {{corridors:[number[], number[], number[], number[]], inter:boolean, main:boolean}} RoomLike
   * @param {LocationLike[]|RoomLike[]} locations
   */
  extendLocations(locations) {
    for (const loc of locations) {
      if (loc.corridors) {
        this.locations.push(
          new Location(structuredClone(loc.corridors), {
            inter: loc.inter,
            main: loc.main,
          })
        );
        continue;
      }
      if (!loc.sides) throw new Error("badly structured location object");
      this.locations.push(
        new Location(structuredClone(loc.sides), { ...loc.flags })
      );
    }
  }

  /**
   * Encode the relations between the locations given the available exits and
   * joins (corridors) at each.
   */
  commit() {
    this._resetCommit();

    for (let locationId = 0; locationId < this.locations.length; locationId++) {
      const sideExits = this.locationExitChoices(locationId); // the flattened list of [[side, exit], ...., [side, exit]]
      const location = new LocationChoices(locationId, sideExits);

      let leaf = new LeafObject({
        type: LocationChoices.ObjectType,
        leaf: location,
      });

      const locationChoicesKey = leafHash(this.prepareLeaf(leaf));
      if (locationChoicesKey in this.locationChoicesKeys)
        throw new Error(
          `locations are expected to be naturally unique`
        );

      this.locationChoices.push(leaf);
      this.locationChoicesKeys[locationChoicesKey] = this.locationChoices.length - 1;

      // We need a node for each of the locations exits. We most easily derive this from the exitMenu
      for (let j = 0; j < sideExits.length; j++) {

        const locationChoiceRef = new LogicalRef(
          LogicalRefType.ProofInput,
          ObjectType.LocationChoices,
          locationId,
          location.iChoices() + j
        );
        const locationExit = new LocationExit(locationChoiceRef);

        leaf = new LeafObject({
          type: LocationExit.ObjectType,
          leaf: locationExit,
        });
        const key = leafHash(this.prepareLeaf(leaf));

        const locationExitIndex = this.exits.length;
        this.exitKeys[key] = locationExitIndex;
        this.locationExits[
          `${locationId}:${sideExits[j][0]}:${sideExits[j][1]}`
        ] = locationExitIndex;
        this.exits.push(leaf);
      }
    }

    for (const link of this.links()) {
      const ida = this.exitId(link.a.location, link.a.side, link.a.exit);
      const idb = this.exitId(link.b.location, link.b.side, link.b.exit);
      const refa = new LogicalRef(LogicalRefType.Proof, ObjectType.Exit, ida);
      const refb = new LogicalRef(LogicalRefType.Proof, ObjectType.Exit, idb);

      const locationExitLinkAB = new LocationLink(refa, refb);
      let leaf = new LeafObject({
        type: ObjectType.Link2,
        leaf: locationExitLinkAB,
      });
      let key = leafHash(this.prepareLeaf(leaf));
      let locationExitLinkIndex = this.locationExitLinks.length;
      this.locationExitLinkKeys[key] = locationExitLinkIndex;
      this.locationExitLinks.push(leaf);

      /*
      const locationExitLinkBA = new LocationLink(refb, refa);
      leaf = new LeafObject({type:ObjectType.Link2, leaf:locationExitLinkBA});
      key = leafHash(this.prepareLeaf(leaf));
      if (key in this.locationExitLinkKeys)
        throw new Error(`uh really ?`);
      locationExitLinkIndex = this.locationExitLinks.length;
      this.locationExitLinkKeys[key] = locationExitLinkIndex;
      this.locationExitLinks.push(leaf);
      */
    }

    this._committed = true;
  }

  /**
   * Convenience to encode the whole topology as a merkle tree.
   * @returns {StandardMerkleTree}
   */
  encodeTrie() {
    if (!this._committed) this.commit();
    return StandardMerkleTree.of([...this.leaves()], LeafObject.ABI);
  }

  *leaves() {

    // locationChoices encodes a location and the choices that exist there
    for (const leaf of this.locationChoices) yield this.prepareLeaf(leaf);

    for (const leaf of this.exits) yield this.prepareLeaf(leaf);

    for (const leaf of this.locationExitLinks) yield this.prepareLeaf(leaf);
    // for (const link of this.links())
    //   yield this.prepareObject({type:ObjectType.Link, leaf:link});
  }

  /**
   *
   * @param {{type, leaf}} o
   */
  prepareObject(o) {
    return this.prepareLeaf(new LeafObject(o));
  }

  /**
   *
   * @param {LeafObject} lo
   * @returns {[number, BytesLike]}
   */
  prepareLeaf(lo) {
    return ObjectCodec.prepare(lo, {
      resolveValue: this.resolveValueRef.bind(this),
    });
  }

  hydratePrepared(prepared) {
    return ObjectCodec.hydrate(prepared, {
      recoverTarget: this.recoverTarget.bind(this),
    });
  }

  referenceProofInput(targetType, id, options) {
    let input;
    switch (targetType) {
      case ObjectType.ExitMenu:
        input = this.exitMenus[id].leaf.matchInput(options);
        break;
    }
    if (typeof input === "undefined")
      throw new Error(`input not matched for targetType ${targetType}`);

    return new LogicalRef(LogicalRefType.ProofInput, targetType, id, input);
  }

  /**
   * Return the exit id for the location, side, exit triple
   * @param {*} location 
   * @param {*} side 
   * @param {*} exit 
   */
  exitId(location, side, exit) {
    const id = this.locationExits[`${location}:${side}:${exit}`];
    if (typeof id === 'undefined')
      throw new Error(`location exit not found for ${location}:${side}:${exit}`);
    return id;
  }

  /**
   * 
   * @param {number} typeId 
   * @param {number} id 
   */
  leaf(typeId, id) {
    switch (typeId) {
      case ObjectType.LocationChoices:
        return this.locationChoices[id];
      case ObjectType.Exit:
        return this.exits[id];
      case ObjectType.Link2:
        return this.locationExitLinks[id];
    }
    return undefined;
  }

  /**
   *
   * @param {LogicalRef} ref
   */
  resolveValueRef(ref) {
    const target = this.leaf(ref.targetType, ref.id);
    if (!target)
      throw new Error(`unknown reference targetType ${ref.targetType}`);

    switch (ref.type) {
      case LogicalRefType.Proof:
        // referencing the encoded, provable, leaf value
        return leafHash(this.prepareLeaf(target));
      case LogicalRefType.ProofInput:
        // prepared is [type, inputs]. inputs is always a 2 dimensional array

        const targetHash = leafHash(this.prepareLeaf(target));
        const inputs = target.leaf.inputs({
          resolveValue: this.resolveValueRef.bind(this),
        });
        return [targetHash, ...inputs[ref.index]];
      default:
        throw new Error(`unsupported reference type ${ref.type}`);
    }
  }

  /**
   * Notice: this does not recover the index if the type is ProofInput. The
   * caller is expected to have that context
   * @param {*} targetType
   * @param {*} value
   * @returns
   */
  recoverTarget(targetType, value) {
    let id, target;

    switch (ref.targetType) {
      case ObjectType.ExitMenu:
        // value is the leaf encoding of an exit
        id = this.exitMenuKeys[value];
        target = this.exitMenus[id];
        break;
      case ObjectType.Location2:
        id = this.locationChoicesKeys[value];
        target = this.locationMenu[id];
        break;
      case ObjectType.Exit:
        // value is the leaf encoding of an exit
        id = this.exitKeys[value];
        target = this.exits[id];
        break;
      case ObjectType.Link2:
        id = this.locationExitLinkKeys[value];
        target = this.locationExitLinks[id];
        break;
    }
    if (!target) throw new Error(`targetType not known or tbd`);
    return new LogicalRef(type, targetType, id);
  }

  /**
   * Yield all the location links on the topology. Yields both A->B and B->A by default.
   * @template {{unique:boolean}} OptionsLike
   * @param {OptionsLike} options
   * @returns {Link}
   */
  *links(options) {
    for (let i = 0; i < this.joins.length; i++) {
      const link = this.joinedLink(i);
      yield link;
      if (options?.unique) continue;
      // So we get A->B and B->A, and in future we may support one-way-doors
      yield new Link(link.b, link.a);
    }
  }

  /**
   * Return the merkle encode choice nodes available at location
   * @param {number} location
   */
  locationChoices(location) {
    const choices = [];
    for (let side = 0; side < 4; side++) {
      for (const prepared of this.locationSideChoices(location, side)) {
        choices.push(leafHash(prepared));
      }
    }
    return choices;
  }

  /**
   * Enumerate the choices available at the location, on the specific side. The yields are encoded as LeafObjects
   * @param {number} location
   * @param {number} side
   * @param {any} options
   */
  *locationSideChoices(location, side, options) {
    for (const link of this.locationSideLinks(location, side, options)) {
      yield ObjectCodec.prepare(
        new LeafObject({ type: ObjectType.Link, leaf: link })
      );
    }
  }

  /**
   * Enumerate the location links available at the location for the specific side
   * @param {number} location
   * @param {number} side
   * @param {any} options
   */
  *locationSideLinks(location, side, options) {
    const loc = this.locations[location];
    for (let exit = 0; exit < loc.sides[side].length; exit++) {
      const egress = new Access({ location, side, exit });
      const ingress = this.accessJoin(egress);
      yield new Link(egress, ingress);
    }
  }

  locationExitChoices(location) {
    const choices = [];
    const loc = this.locations[location];
    for (let side = 0; side < loc.sides.length; side++) {
      // for the specific case of exits we could compress this by just storing
      // the counts, but we want the choice menus to be more general beasts.
      for (let exit=0; exit < loc.sides[side].length; exit++)
        choices.push([side, exit])
    }
    return choices;
  }

  /**
   * Return the link representation of the identified join
   * @param {number} join
   * @returns {Link}
   */
  joinedLink(join) {
    return new Link(this.joinAccess(join, 0), this.joinAccess(join, 1));
  }

  /**
   * Return the link representation of the egress & corresponding ingress accesses
   * @param {AccessLike} egress an access like object with location, side and exit properties
   * @returns {Link} a link where link.a is the egress and link.b the ingress at the other side.
   */
  linkedAccess(egress) {
    return new Link(egress, this.accessJoin(egress));
  }

  /**
   * Return the access on the other side of the join identified by the egress access
   * @param {AccessLike} egress an access like object with location, side and exit properties
   * @returns {Access}
   */
  accessJoin(egress) {
    const [location, side, exit] = this._accessJoin(
      egress.location,
      egress.side,
      egress.exit
    );
    return new Access({ location, side, exit });
  }

  /**
   * Return the location, side and access on the other side of the argument join
   * @param {number} loc the location of egress
   * @param {number} side the side of room egress
   * @param {number} which the egress exit index in the side
   * @returns {[number, number, number]}
   */
  _accessJoin(loc, side, which) {
    const iJoin = this.locations[loc]?.sides[side]?.[which];
    if (typeof iJoin === "undefined")
      throw new Error(`invalid egress ${loc}:${side}${which}`);
    const join = this.joins[iJoin];

    // get the other side by matching the egress side in the join and then taking the other entry
    const ingressSide = join.joins[0] === loc ? join.sides[1] : join.sides[0];
    // similarly for the ingress location
    const ingressLoc = join.joins[0] === loc ? join.joins[1] : join.joins[0];
    // now we find the exit index by searching the ingress location, side for the join
    const ingressWhich = this.exitIndex(iJoin, ingressLoc, ingressSide);
    if (typeof ingressWhich === "undefined")
      throw new Error(
        `invalid map, exitIndex not found for ${join}:${loc}:${ingressSide}`
      );

    return [ingressLoc, ingressSide, ingressWhich];
  }

  /**
   * Find the exit index in the location side that contains a reference to the
   * argument join.
   * @param {number} join index into joins
   * @param {number} loc index into locations
   * @param {0|1|2|3} side index into location sides
   * @return {number|undefined} the access index (also known as the exit index)
   */
  exitIndex(join, loc, side) {
    // The access index is the index in the location side whose value matches i
    const sideAccesses = this.locations[loc].sides[side];
    for (let i = 0; i < sideAccesses.length; i++) {
      if (sideAccesses[i] === join) return i;
    }
    return undefined;
  }

  /**
   * Returns an Access instance, with location, side and exit index properties
   * for the identified 'end' of the join.
   * @param {number} join joins entry index
   * @param {0|1} which side of the join that is desired
   * @returns {Access}
   */
  joinAccess(join, which) {
    if (which !== 0 && which !== 1)
      throw new Error(`which must be 0 or 1, not ${which}`);
    if (join >= this.joins.length)
      throw new Error(
        `join index ${join} is out of range. last is ${this.joins.length - 1}`
      );

    const [location, side] = [
      this.joins[join].joins[which],
      this.joins[join].sides[which],
    ];

    // The access index is the index in the location side whose value matches i
    const exit = this.exitIndex(join, location, side);

    if (typeof exit === "undefined")
      throw Error(
        `join ${join} does not have a corresponding access entry on location ${location}`
      );

    return new Access({ location, side, exit });
  }
}
