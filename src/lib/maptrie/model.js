import { LogicalTopology } from "./logical.js";
import { Geometry } from "./geometry.js";

export class Model {
  constructor() {
    // @type LogicalTopology
    this.logical;

    // @type Geometry
    this.geometry;
  }
}
