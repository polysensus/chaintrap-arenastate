import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { LogicalTopology } from "../../src/lib/maptrie/logical.js";
import { ObjectCodec, LeafObject } from "../../src/lib/maptrie/objects.js";

import map02_json from "../../data/maps/map02.json" assert { type: "json" };
const { map02 } = map02_json;

export function topologyForMap02() {
  const topo = new LogicalTopology();
  topo.extendJoins(map02.model.corridors); // rooms 0,1 sides EAST, WEST
  topo.extendLocations(map02.model.rooms);
  return topo;
}

export function trieForMap02() {
  const topo = new LogicalTopology();
  topo.extendJoins(map02.model.corridors);
  topo.extendLocations(map02.model.rooms);

  const leaves = topo.links().map(
    (link) =>
      new LeafObject({
        type: ObjectType.Link2,
        leaf: link,
      })
  );

  return StandardMerkleTree.of(leaves, LeafObject.ABI);
}
