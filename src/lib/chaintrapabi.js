import { ethers } from "ethers";
// export { abi as diamondABI } from "@polysensus/chaintrap-contracts/abi/Diamond.json" assert { type: "json" };
import  diamondSol from "@polysensus/chaintrap-contracts/abi/Diamond.json" assert { type: "json" };
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

import { createERC2535Proxy } from "@polysensus/chaintrap-contracts/chaintrap/erc2535proxy.mjs";

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
      ERC1155ArenaFacetSol: erc1155ArenaFacetABI,
    },
    providerOrSigner
  );
  return arena;
}

export function arenaInterface(abi) {
  return new ethers.utils.Interface(abi);
}
