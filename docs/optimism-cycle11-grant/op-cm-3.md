# Critical Milestone 3, Chaintrap, builders, cycle 11

Our focus for this milestone has been introducing peril to the game.

We have added our first type of trap. When the dungeon trial is created the creator can place openable chests on the map. The trialist can commit to open the chest and the dungeon creator then proves the outcome. In this release we only have one kind of chest: the kind that is fatal if opened. In the next MS we will had a treat - an openable chest that grants a free life to the trialist.

Supplimental to the deliverables we have also addes a simple PBKDF/AES encryption scheme to allow map creators to store their maps in IPFS and link them to the game token metadata. The purpose of this scheme is not long term secrecy, it allows the map creator to delay revealing the full map and dungeon configuration for the game session. The maps and game tokens are easy to create, and after the game session is complete there value lies in their transparency.

The scheme allows the same content to be encrypted under many, password derived keys, so that the reveal need not be all or nothing. We do not expect the passwords to be managed, we just expect them to be revealed after play. Our default password for all test net evidence is

    very-secret

Lastly, we have published part 2 of our series on the inspiration and making of chaintrap.

[Blockchain game table stakes, and the tracing paper model](https://robinbryce.medium.com/blockchain-game-table-stakes-and-the-tracing-paper-model-7bcab1ee9be6)

## release info for this CMS

- https://github.com/polysensus/chaintrap-arenastate/releases/tag/v0.0.26 game libary and command line tool
- https://github.com/polysensus/chaintrap-contracts/releases/tag/v0.3.4 game contracts
- https://github.com/polysensus/blobcodex/releases/tag/v0.0.7 json schema for storing pbdkf/aes encrypted blobs
- https://github.com/polysensus/diamond-deploy/releases/tag/v0.3.3 ERC 2535 diamond deployment tool

## contract address and source verification

For this release our contract is deployed at `0x018678a99cb89402311F58d503b013bA421D36C5`. We have verified the sources so they can be introspected on [louper](https://louper.dev/diamond/0x018678a99cb89402311F58d503b013bA421D36C5?network=optimism_goerli) and also on [goerli-etherscan](https://goerli-optimism.etherscan.io/address/0x018678a99cb89402311F58d503b013bA421D36C5)

Its a diamond proxy, and all the facets have also been verified.

## Deliverables

### A. Support fatal death traps

1. traps are minted to the dungeon host on game session creation
2. Using the javascript library, the dungeon host can place traps before the game session starts.
3. A player can activate a trap (opens chest) and as a consequence is ‘halted’.

We chose not to model the traps as NFT's as it felt too heavy weight from the perspective of the creator and the flow of setting up a dungeon trial. For now, traps and treats are simply content commited to the merkleisation of the dungeon at the start of the game.

So we instead provided the blobcodex format so that per game session content could form part of the game session NFT metadata. We may develop this further tho - we like the idea that the armoury of respective dungeon hosts could be modeled as nft's they own and _could_ have chosen to _use_ for a specific game session. We felt we got a lot more bang for our developer buck with the encrypted metadata idea.

The events for the game session with a player 'fatality'

- https://goerli-optimism.etherscan.io/address/0x018678a99cb89402311f58d503b013ba421d36c5
- https://goerli-optimism.etherscan.io/tx/0xf02b10b7fcd96afdd4354157873226a2c1df6d02edf33f4df5d56c6cdaced543 (the start of the game session)

A Game session NFT, with the map and the furniture stored and encrypted in the metadata

- https://testnets.opensea.io/assets/optimism-goerli/0x018678a99cb89402311f58d503b013ba421d36c5/1361129467683753853853498429727072845826

The public map commitment on the token metadata:

- https://ipfs.io/ipfs/bafyreifjezk7eimjqypt54al374jcl76tde2dsml4dol3nqtuhy73othga/metadata.json

The encrypted map and placed furniture for the session, is referenced from the token metadata in the 'trialsetup' field

- https://ipfs.io/bafybeieqam5xf6aaueyhryweragew6xus6os4l66a7ji2rvirhztmn3vki/trial-setup.json

This is an [example](./data/maps/map02-furnishings.json) of the data used by the client to add a placable death trap to the game session prior to starting play.

Hardhat CI/CD test run of the same game sequence

- https://github.com/polysensus/chaintrap-arenastate/actions/runs/6005214456/job/16287470931
