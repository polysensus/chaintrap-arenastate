# Critical Milestone 4, Chaintrap, builders, cycle 11

Our focus for this milestone has been introducing the first bonus item (treat)
to the gam and adding the necessary per player state.

We have added our first type of bonus confering placable item. As with the deadly traps introduced in MS3, the bonus item is an openable chest. Now when a player encounteres a chest it could be *either* instant death or a bonus life. The bonus life allows the player to survive a single deadly trap.

## release info for this CMD

- https://github.com/polysensus/chaintrap-arenastate/releases/tag/v0.0.27 game libary and command line tool
- https://github.com/polysensus/chaintrap-contracts/releases/tag/v0.3.6 game contracts

## contract address and source verification

For this release our contract is deployed at `0xE2dFf268B0e0532Bb9C07cD1425031e8B9827C71`.

We have verified the sources so they can be introspected on [louper](https://louper.dev/diamond/0xE2dFf268B0e0532Bb9C07cD1425031e8B9827C71?network=optimism_goerli)

And also on [goerli-etherscan](https://goerli-optimism.etherscan.io/address/0xE2dFf268B0e0532Bb9C07cD1425031e8B9827C71)

Its a diamond proxy, and all the facets have also been verified.

## Deliverables

### A. Support bonus life treat

1. treats are minited to the Dungeon host on game session creation
2. A player can activate a treat (opens chest) and 'gain a life'
3. A player can activate a trap (opens chest) and survive a death trap

For 1, we have chosen not to model the treats as NFT's for now, we might revisit this in later submissions.

The on chain proof was created with this test script:

- https://github.com/polysensus/chaintrap-arenastate/blob/main/taskfiles/Taskfile_cms4.yml

The output from this script, running for hardhat, can be found on the CI test run here: https://github.com/polysensus/chaintrap-arenastate/actions/runs/6066677115/job/16457534009

(The test cms4 output is a little less opaque than the raw transactions)

The same script was then run on optimism goerli. Transactions of note:

Trialist 2 commits to opening the second chest here:

https://goerli-optimism.etherscan.io/tx/0x9034a11e494906869c98717efe4e9e4151915e68e474f5ca8cb84d5bfd41563f

The proof of the outcome and the bonus life are applied in the subsequent reveal tx

https://goerli-optimism.etherscan.io/tx/0xc569e8885857bf97902920cd69ec6ad033374e4a6ac3136a1c87cfa5f6814f12

Trialist 2 then commits to opening the first (death trap) chest

https://goerli-optimism.etherscan.io/tx/0xe7ee6927016b7748a1f5c310d101a386f0e0d72272122a8b43d8080c02e5866d

And in the reveal tx, they are *not* halted

https://goerli-optimism.etherscan.io/tx/0xdb1d38a4874869b0413ca91840550d784184d37890f7a94af3299447ae14174c

This covers 2. & 3.