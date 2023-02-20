import { ethers } from "ethers";
import diamondSol from "@polysensus/chaintrap-contracts/abi/Diamond.json" assert { type: "json" };
import diamondCutFacetSol from "@polysensus/chaintrap-contracts/abi/DiamondCutFacet.json" assert { type: "json" };
import diamondLoupeFacetSol from "@polysensus/chaintrap-contracts/abi/DiamondLoupeFacet.json" assert { type: "json" };
import ownershipFacetSol from "@polysensus/chaintrap-contracts/abi/OwnershipFacet.json" assert { type: "json" };
import arenaCallsFacetSol from "@polysensus/chaintrap-contracts/abi/ArenaCallsFacet.json" assert { type: "json" };
import arenaFacetSol from "@polysensus/chaintrap-contracts/abi/ArenaFacet.json" assert { type: "json" };
import arenaTranscriptsFacetSol from "@polysensus/chaintrap-contracts/abi/ArenaTranscriptsFacet.json" assert { type: "json" };
import erc1155ArenaFacetSol from "@polysensus/chaintrap-contracts/abi/ERC1155ArenaFacet.json" assert { type: "json" };
import { createERC2535Proxy } from "@polysensus/chaintrap-contracts/chaintrap/erc2535proxy.mjs";

export function arenaConnect(diamondAddress, providerOrSigner) {
  const arena = createERC2535Proxy(
    diamondAddress,
    diamondSol.abi,
    {
      DiamondCutFacet: diamondCutFacetSol.abi,
      DiamondLoupeFacet: diamondLoupeFacetSol.abi,
      OwnershipFacet: ownershipFacetSol.abi,
      ArenaCallsFacet: arenaCallsFacetSol.abi,
      ArenaFacet: arenaFacetSol.abi,
      ArenaTranscriptsFacet: arenaTranscriptsFacetSol.abi,
      ERC1155ArenaFacetSol: erc1155ArenaFacetSol.abi,
    },
    providerOrSigner
  );
  return arena;
}

export function arenaInterface(abi) {
  return new ethers.utils.Interface(abi);
}
