import { ethers } from "ethers";

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { Join } from "./join.js";
import { Access } from "./access.js";
import { Link } from "./link.js";
import { LocationChoices } from "./locationchoices.js";
import { LocationExit } from "./locationexit.js";
import { FinishExit } from "./finishexit.js";
import { LocationLink } from "./locationlink.js";
import { ObjectCodec, LeafObject, leafHash } from "./objects.js";
import { ObjectType } from "./objecttypes.js";
import { LogicalRef, LogicalRefType } from "./logicalref.js";
import { Location } from "./location.js";
import { LocationFurnishing } from "./locationfurnishing.js";

export function rootLabel(map) {
  if (!map)
    throw new Error(
      "a map root label is required or a map object from which to derive one"
    );
  let rootLabel = `chaintrap:static`;

  const beta = map.vrf_inputs?.proof?.beta.slice(0, 8);
  return beta ? `${rootLabel}:${beta}` : rootLabel;
}

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

    this.locationChoices = [];
    this.locationChoicesPrepared = [];
    this.locationChoicesProof = [];
    this.locationChoicesKeys = {};

    this.exits = [];
    this.exitsPrepared = [];
    this.exitsProof = [];
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
    this.locationExitLinksPrepared = [];
    this.locationExitLinksProof = [];
    this.locationExitLinkKeys = {};
    this.locationExitLinkIds = {};

    this.finishLocationId = undefined;
    this.finishExitId = undefined;

    /**
     * @readonly
     */
    this.trie = undefined;
    this._committed = false;
  }

  _resetCommit() {
    this.locationChoices = [];
    this.locationChoicesPrepared = [];
    this.locationChoicesProof = [];
    this.locationChoicesKeys = {};
    this.exits = [];
    this.exitsPrepared = [];
    this.exitsProof = [];
    this.exitKeys = {};
    this.locationExits = {};
    this.locationExitLinks = [];
    this.locationExitLinksPrepared = [];
    this.locationExitLinksProof = [];
    this.locationExitLinkKeys = {};

    this.furnLeafs = [];
    this.furnPrepared = [];
    this.furnProof = [];
    this.furnKeys = {};
    // `${location}:${<ChoiceInputType>}:${furnIndex}` furnIndex means the i'th chest in the location, it doesn't index anywhere else. it is refered to by the furniture leaves.
    this.locationFurn = {};

    this._trie = undefined;
    this._committed = false;
  }

  static fromMapJSON(map) {
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

  // ---
  // furniture placement methods

  placeFinish(finish) {
    this.finish = finish;
  }
  placeFurniture(furniture) {
    this.furniture = furniture;
  }

  /**
   * Commit the whole map topology to a merkle trie, building a cache of entries
   * for use during the game.
   * @returns {StandardMerkleTree}
   */
  commit() {
    this._resetCommit();

    if (!this.finish)
      throw new Error(`a finish must be placed before committing the trie`);

    for (let locationId = 0; locationId < this.locations.length; locationId++) {
      const sideExits = this.locationExitChoices(locationId); // the flattened list of [[side, exit], ...., [side, exit]]
      const furnitureChoices = this.locationFurnitureChoices(locationId); // [[OpenChest, 0], ..., [OpenChest, n]

      if (this.finish.item.data.location === locationId) {
        // check the finish does not conflict with a side, exit from the generated map
        for (const [side, exit] of sideExits)
          if (this.finish.item.data.side === side && this.finish.item.data.exit === exit)
            throw new Error(`finish placement conflicts with map exit`);
        sideExits.push([this.finish.item.data.side, this.finish.item.data.exit]);
      }
      const location = new LocationChoices(locationId, sideExits, furnitureChoices.choices);

      let leafObject = new LeafObject({
        type: LocationChoices.ObjectType,
        leaf: location,
      });
      let prepared = this.prepareLeaf(leafObject);

      let key = leafHash(prepared);
      if (key in this.locationChoicesKeys)
        throw new Error(`locations are expected to be naturally unique`);

      this.locationChoices.push(leafObject);
      this.locationChoicesPrepared.push(prepared);
      this.locationChoicesProof.push();
      this.locationChoicesKeys[key] = this.locationChoices.length - 1;

      // We need a node for each of the locations exits. We most easily derive this from the exitMenu
      for (let j = 0; j < sideExits.length; j++) {
        const locationChoiceRef = new LogicalRef(
          LogicalRefType.ProofInput,
          ObjectType.LocationChoices,
          locationId,
          location.iChoices() + j
        );

        // if we placed the finish exit in this location, build the choices accordingly
        if (
          this.finish.item.data.location === locationId &&
          j === sideExits.length - 1
        ) {
          leafObject = new LeafObject({
            type: FinishExit.ObjectType,
            leaf: new FinishExit(locationChoiceRef),
          });
          this.finishExitId = this.exits.length; // it is added below
          this.finishLocationId = this.locationChoices.length - 1; // it was added above
        } else {
          leafObject = new LeafObject({
            type: LocationExit.ObjectType,
            leaf: new LocationExit(locationChoiceRef),
          });
        }

        prepared = this.prepareLeaf(leafObject);
        key = leafHash(prepared);

        const id = this.exits.length;
        this.exitKeys[key] = id;
        this.locationExits[
          `${locationId}:${sideExits[j][0]}:${sideExits[j][1]}`
        ] = id;
        this.exits.push(leafObject);
        this.exitsPrepared.push(prepared);
      }

      // We need a node for all furniture placed at specific locations. (except
      // for the finish exit which is a special exit)

      // Create the choice references for the chests placed at this location
      const furniture = furnitureChoices.furniture;
      for (let j = 0; j < furniture.length; j++) {

        const furn = furniture[j];

        const locationChoiceRef = new LogicalRef(
          LogicalRefType.ProofInput,
          ObjectType.LocationChoices,
          locationId,
          location.iChoices() + sideExits.length + j
        );
        leafObject = new LeafObject({
          type: furn.type,
          leaf: new LocationFurnishing(furn, locationChoiceRef),
        });
        prepared = this.prepareLeaf(leafObject);
        key = leafHash(prepared);

        this.furnKeys[key] = furn.id; // leaf hash -> this.furniture.items[index]
        this.locationFurn[
          `${locationId}:${furn.choiceType}:${j}`
        ] = furn.id;
        this.furnLeafs.push(leafObject);
        this.furnPrepared.push(prepared);
      }
    }

    for (const link of this.links()) {
      // Note: there is no link for the finish exit, it is just a choice that completes the trial
      const ida = this.exitId(link.a.location, link.a.side, link.a.exit);
      const idb = this.exitId(link.b.location, link.b.side, link.b.exit);
      const refa = new LogicalRef(LogicalRefType.Proof, ObjectType.Exit, ida);
      const refb = new LogicalRef(LogicalRefType.Proof, ObjectType.Exit, idb);

      const locationExitLinkAB = new LocationLink(refa, refb);
      let leaf = new LeafObject({
        type: ObjectType.Link2,
        leaf: locationExitLinkAB,
      });
      let prepared = this.prepareLeaf(leaf);
      let key = leafHash(prepared);
      let locationExitLinkIndex = this.locationExitLinks.length;
      this.locationExitLinkKeys[key] = locationExitLinkIndex;
      this.locationExitLinks.push(leaf);
      this.locationExitLinksPrepared.push(prepared);
      this.locationExitLinkIds[
        `${link.a.location}:${link.a.side}:${link.a.exit}`
      ] = locationExitLinkIndex;
    }

    // now do the furniture

    this.trie = StandardMerkleTree.of(
      [
        ...this.locationChoicesPrepared,
        ...this.exitsPrepared,
        ...this.locationExitLinksPrepared,
        ...this.furnPrepared
      ],
      LeafObject.ABI
    );

    for (const prepared of this.locationChoicesPrepared)
      this.locationChoicesProof.push(this.trie.getProof(prepared));

    for (const prepared of this.exitsPrepared)
      this.exitsProof.push(this.trie.getProof(prepared));

    for (const prepared of this.locationExitLinksPrepared)
      this.locationExitLinksProof.push(this.trie.getProof(prepared));

    for (const prepared of this.furnPrepared)
      this.furnProof.push(this.trie.getProof(prepared));

    this._committed = true;
    return this.trie;
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

  referenceProofInput(targetType, id, options) {
    let input;
    switch (targetType) {
      case ObjectType.LocationChoices:
        input = this.locationChoices[id].leaf.matchInput(options);
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
    if (typeof id === "undefined")
      throw new Error(
        `location exit not found for ${location}:${side}:${exit}`
      );
    return id;
  }
  locationLinkId(location, side, exit) {
    const id = this.locationExitLinkIds[`${location}:${side}:${exit}`];
    if (typeof id === "undefined")
      throw new Error(
        `location exit not found for ${location}:${side}:${exit}`
      );
    return id;
  }

  furnitureId(location, choiceType, index) {
    const id = this.locationFurnuture[`${location}:${choiceType}:${index}`];
    if (typeof id === 'undefined')
      throw new Error(
        `location furniture not found for ${location}:${choiceType}:${index}`
      );
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
      case ObjectType.Finish:
        return this.exits[id];
      case ObjectType.Link2:
        return this.locationExitLinks[id];
      case ObjectType.FinishExit:
        return this.furnLeafts[id];
      case ObjectType.FatalChestTrap:
        return this.furnLeafts[id];
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

  locationExitChoices(location) {
    const choices = [];
    const loc = this.locations[location];
    for (let side = 0; side < loc.sides.length; side++) {
      // for the specific case of exits we could compress this by just storing
      // the counts, but we want the choice menus to be more general beasts.
      for (let exit = 0; exit < loc.sides[side].length; exit++)
        choices.push([side, exit]);
    }
    return choices;
  }

  locationFurnitureChoices(location) {

    if (!this.furniture) return [];

    // The first 4 choice entries are the 'sides', further entries will have
    // fixed meaning. The first such entry represents a list of openable chests
    // [sides 0-3, [ChoiceType, ], [open, chest-b], ...]]
    const choices = [];

    const furniture = this.furniture.byLocation(location);
    const choosable = []; // FinishExits are furniture but they are handled as exits

    for (let i = 0; i < furniture.length; i++) {
      const furn = furniture[i];
      if (typeof furn.choiceType === 'undefined') continue;
      choices.push([furn.choiceType, i])
      choosable.push(furn)
    }
    return {furniture:choosable, choices};
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
