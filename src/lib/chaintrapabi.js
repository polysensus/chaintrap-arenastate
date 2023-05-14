import { ethers } from "ethers";
// export { abi as diamondABI } from "@polysensus/chaintrap-contracts/abi/Diamond.json" assert { type: "json" };
import diamondSol from "@polysensus/chaintrap-contracts/abi/Diamond.json" assert { type: "json" };
export const diamondABI = diamondSol.abi;

import diamondCutFacetSol from "@polysensus/chaintrap-contracts/abi/DiamondCutFacet.json" assert { type: "json" };
export const diamondCutFacetABI = diamondCutFacetSol.abi;

import diamondLoupeFacetSol from "@polysensus/chaintrap-contracts/abi/DiamondLoupeFacet.json" assert { type: "json" };
export const diamondLoupeFacetABI = diamondLoupeFacetSol.abi;

import ownershipFacetSol from "@polysensus/chaintrap-contracts/abi/OwnershipFacet.json" assert { type: "json" };
export const ownershipFacetABI = ownershipFacetSol.abi;

import arenaCallsFacetSol from "@polysensus/chaintrap-contracts/abi/ArenaCallsFacet.json" assert { type: "json" };
export const arenaCallsFacetABI = arenaCallsFacetSol.abi;

import arenaFacetSol from "@polysensus/chaintrap-contracts/abi/ArenaFacet.json" assert { type: "json" };
export const arenaFacetABI = arenaFacetSol.abi;

import arenaTranscriptsFacetSol from "@polysensus/chaintrap-contracts/abi/ArenaTranscriptsFacet.json" assert { type: "json" };
export const arenaTranscriptsFacetABI = arenaTranscriptsFacetSol.abi;

import erc1155ArenaFacetSol from "@polysensus/chaintrap-contracts/abi/ERC1155ArenaFacet.json" assert { type: "json" };
export const erc1155ArenaFacetABI = erc1155ArenaFacetSol.abi;

import { createERC2535Proxy } from "@polysensus/chaintrap-contracts";

export function matchCustomError(selectErrors, err) {
  if (!err.reason) return [undefined, "no reason property on err"];
  const matched = err.reason.match(
    /reverted with an unrecognized custom error.*data: (0x[0-9a-f]{8})([0-9a-f]*)/
  );
  if (!matched)
    return [undefined, "custom error indicator not matched in reason"];
  return [selectErrors[matched[1]], matched[2]];
}
export function customError(selectErrors, err) {
  const [f, data] = matchCustomError(selectErrors, err);
  if (!f) return err;
  return new Error(f.format(), { cause: err });
}

export function reduceErrors(fragments, abi) {
  errors = abi.reduce((fragments, current) => {
    if (current.type !== "error") return errors;
    fragments.push(ethers.utils.ErrorFragment.from(current));
    return fragments;
  }, fragments);
  return errors;
}

export function errorABISelectors() {
  const errors = {};
  for (const abi of [
    diamondABI,
    diamondCutFacetABI,
    diamondLoupeFacetABI,
    ownershipFacetABI,
    arenaFacetABI,
    arenaTranscriptsFacetABI,
    erc1155ArenaFacetABI,
  ]) {
    abi.reduce((errors, current) => {
      if (current.type !== "error") return errors;
      const fragment = ethers.utils.ErrorFragment.from(current);
      const selector = ethers.utils.hexDataSlice(
        ethers.utils.id(fragment.format()),
        0,
        4
      );
      errors[selector] = fragment;
      return errors;
    }, errors);
  }
  return errors;
}

export function arenaConnect(diamondAddress, providerOrSigner) {
  const arena = createERC2535Proxy(
    diamondAddress,
    diamondABI,
    {
      DiamondCutFacet: diamondCutFacetABI,
      DiamondLoupeFacet: diamondLoupeFacetABI,
      OwnershipFacet: ownershipFacetABI,
      ArenaCallsFacet: arenaCallsFacetABI,
      ArenaFacet: arenaFacetABI,
      ArenaTranscriptsFacet: arenaTranscriptsFacetABI,
      ERC1155ArenaFacet: erc1155ArenaFacetABI,
    },
    providerOrSigner
  );
  return arena;
}

export function arenaInterface(abi) {
  return new ethers.utils.Interface(abi);
}
