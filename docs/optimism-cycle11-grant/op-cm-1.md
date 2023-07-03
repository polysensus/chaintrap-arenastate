# Critical Milestone 1, Chaintrap builders, cycle 11.

Our main focus of this milestone was open sourcing chaintrap and de-risking the move to optimism by showing our game contracts could successfully operate on optimism.

Baseline reference for the accepted milestones can be found [here](https://gov.optimism.io/t/final-chaintrap-builders-cycle-11/5526/6)

## A. Contracts repository available publicly under open source license

https://github.com/polysensus/chaintrap-contracts/blob/main/LICENSE

## B. Game support library available publicly under open source license

https://github.com/polysensus/chaintrap-arenastate/blob/main/LICENSE

## C. Specific playable aspects of the contracts demonstrated by the integration tests.

The integration tests

- game session mint for new map (ERC1155 diamond facet)
- player registration to participate in game session (game facet)
- player start position assignment by dungeon host (game facet)
- game session start by dungeon host
- player choice of next room (game facet)
- game master confirmation of player move (game facet)
- game master completion of game (game facet)
- game transcript confirmation (transcript facet)

### Repository release tags and application baseline

These are evident in the chiantrap-contracts [release-v0.2.13](https://github.com/polysensus/chaintrap-contracts/tree/v0.2.13)

And in the chaintrap-arenastate [release-v0.0.23](https://github.com/polysensus/chaintrap-arenastate/tree/v0.0.23)

The baselines for our repositories are declared in the grant application. Repeated here for convenience:

- https://github.com/polysensus/chaintrap-contracts/commit/cf2061a593acb592bb60f135ddc353e92ffc7c4b
- https://github.com/polysensus/chaintrap-arenastate/commit/5a06a8fb55b2dcd7cfb43fa8e1ddae90a5cb0c6f

### chaintrap-contracts integration tests

The contracts integration tests can be found in the following files

https://github.com/polysensus/chaintrap-contracts/blob/v0.2.13/tests/hh/tests/arena.mjs
https://github.com/polysensus/chaintrap-contracts/blob/v0.2.13/tests/hh/tests/game.mjs
https://github.com/polysensus/chaintrap-contracts/blob/v0.2.13/tests/hh/tests/transcript.mjs

The methods createGame, joinGame, startGame, completeGame, commitExitUse, allowExitUse, loadTranscriptLocations and playTranscript exercise the contracts support for the above points.

Test output from the contract integration tests can be found here

https://github.com/polysensus/chaintrap-contracts/actions/runs/4622946084

Unit tests using foundry are also available at

https://github.com/polysensus/chaintrap-contracts/tree/v0.2.13/tests/forge/tests

### chaintrap-arenastate integration tests

Integration tests for the game support library can be found in the following
files.

- https://github.com/polysensus/chaintrap-arenastate/blob/v0.0.23/src/lib/map/scenecatalog.spec.js
- https://github.com/polysensus/chaintrap-arenastate/blob/v0.0.23/src/lib/stateroster.spec.js
- https://github.com/polysensus/chaintrap-arenastate/blob/v0.0.23/src/lib/player.spec.js

Test output from the arenastate integration tests can be found here

https://github.com/polysensus/chaintrap-arenastate/actions/runs/4651992204/jobs/8231932624

### command line tooling

node js utilities for deploying and interacting with contracts can be found at

- https://github.com/polysensus/chaintrap-arenastate/blob/v0.0.23/deploycli.js
- https://github.com/polysensus/chaintrap-arenastate/blob/v0.0.23/cli.js

All aspects from the integration tests are also achievable using the cli. Including opensea nft testnet game session mint and dall-e game icon creation, provided suitable configuration is made available.

## D. Contracts deployed on optimism testnet

Our test net contract deployments are currently made via this wallet

    0xd5A03137D5a03162b9C82f66934440655E4C41Bf

A diamond proxy deployment can be found at

    0xb62334b545a945c3279c436f8780b06761f91d16

Some example game events can be found here
An example of a player 'join' event can be seen here

    https://goerli-optimism.etherscan.io/address/0xb62334b545a945c3279c436f8780b06761f91d16#events

MethodId 0x47a28618 is the player join event

MethodId 0x37324c04 is the guardian startLocation set event
