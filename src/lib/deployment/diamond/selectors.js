import { ethers } from "ethers";
// note: derived from:
// - https://github.com/mudgen/diamond-1-hardhat/blob/main/scripts/libraries/diamond.js
// - https://github.com/mudgen/diamond-1-hardhat/blob/main/scripts/deploy.js

export const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

export class Selectors {
  constructor(contractInterface) {
    this.interface = contractInterface;
    this.signatures = Object.keys(this.interface.functions);
    this.selectors = this.signatures.reduce((acc, val) => {
      if (val !== "init(bytes)") {
        acc.push(this.interface.getSighash(val));
      }
      return acc;
    }, []);
  }

  funcSelector(func) {
    const abiInterface = new ethers.utils.Interface([func]);
    return abiInterface.getSighash(ethers.utils.Fragment.from(func));
  }

  all() {
    return [...this.selectors];
  }

  only(functionNames) {
    const selectors = this.selectors.filter((v) => {
      for (const functionName of functionNames) {
        if (v === this.interface.getSighash(functionName)) {
          return true;
        }
      }
      return false;
    });
    return selectors;
  }

  excluding(functionNames) {
    const selectors = this.selectors.filter((v) => {
      for (const functionName of functionNames) {
        if (v === this.interface.getSighash(functionName)) {
          return false;
        }
      }
      return true;
    });
    return selectors;
  }

  excludingSignatures(signatures) {
    const iface = new ethers.utils.Interface(
      signatures.map((v) => "function " + v)
    );
    const removeSelectors = signatures.map((v) => iface.getSighash(v));
    return this.selectors.filter((v) => !removeSelectors.includes(v));
  }
}

// find a particular address position in the return value of diamondLoupeFacet.facets()
export function findAddressPositionInFacets(facetAddress, facets) {
  for (let i = 0; i < facets.length; i++) {
    if (facets[i].facetAddress === facetAddress) {
      return i;
    }
  }
}
