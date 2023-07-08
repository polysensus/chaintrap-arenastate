# Critical Milestone 2, Chaintrap builders, cycle 11.

Our main focus for this milestone was creating a minimally completable game. We also experimented with a completely new, and much less game specific, mechanism for committing to and verifying valid game maps and placable items.

Baseline reference for the accepted milestones can be found [here](https://gov.optimism.io/t/final-chaintrap-builders-cycle-11/5526/6)

## release info for this CMS

* https://github.com/polysensus/chaintrap-arenastate/releases/tag/v0.0.25
* https://github.com/polysensus/chaintrap-contracts/releases/tag/v0.3.2

Test runs

* https://github.com/polysensus/chaintrap-contracts/actions/runs/5494993924/jobs/10014101770
* https://github.com/polysensus/chaintrap-arenastate/actions/runs/5495008249/jobs/10014124773

Automated tests demonstrating these deliverables can be found in.

* https://github.com/polysensus/chaintrap-arenastate/blob/main/src/lib/guardian.furnishDungeon.mocha.js
* https://github.com/polysensus/chaintrap-arenastate/blob/main/src/lib/trial.twoMoveVictory.mocha.js

## contract address and source verification

For this release our contract is deployed at `0x0c075885e9EBB701997bA3e1B8D291688Dc0bCEE`. We have verified the sources so they can be introspected on [louper](https://louper.dev/diamond/0x0c075885e9EBB701997bA3e1B8D291688Dc0bCEE?network=optimism_goerli) and also on [goerli-etherscan](https://goerli-optimism.etherscan.io/address/0x0c075885e9ebb701997ba3e1b8d291688dc0bcee#readProxyContract)

Its a diamond proxy, and all the facets have also been verified.

## Deliverables

### A. A placable victory condition

We have defined a simple data format for placable dungeon items. In this release we support just a placable finish. [example](./data/maps/map02-furnishins.json). In the end, because all games need one in order to be valid, we chose not to represent the finish as an 'ownable' item. Its just a property that the game creator must set.

### B. Javascript library support for placing the exit

In this release all game actions have cli support. The [creategame](./src/command/creategame.js) subcommand of cli.js loads a furniture file `guardian.furnishDungeon()`. The dungeon creation will fail if a finish is not included.

We have provided some simple tooling to run test games in [tust-test.yml](./tusk-tests.yml)

### C. First player to the exit halts the game

When the guardian proves the first player has reached the exit the game is halted. This is an irreversible state.

This series of events  on our contract at `0x0c075885e9EBB701997bA3e1B8D291688Dc0bCEE` between block `11692456` and `11694104` show a simple game session. The events can all be browsed here https://goerli-optimism.etherscan.io/address/0x0c075885e9ebb701997ba3e1b8d291688dc0bcee#events

As we verified our contracts for this release quite a lot can be introspected.

At tx `0xc3fe66e39b5c77d0252f6a56e964469229e1733aff939b1483aa2794c7c6b5f2` the guardian calls `createGame` game session is *minted*.

The player joins the game by calling `registerTrialist` at tx `0x20214de98b55738ffcda77760698dc9bca6726148a2c0b2b624ca9faee71b1e8`

The guardian starts the game at `0xf3d3be180676b77a209eb6f45f5cbf88fa30a6367d2256043364d410a2566fd2` calling `startTranscript`. The guardian provides the merkle proofs which show the start location choices were committed in the map when the game was created. Those choices are emitted by `TranscriptEntryChoices` in the same transaction.

The emitted `TranscriptEntrychoices` encodes the location and the available exits at that location. `[[locationId], [side, exit], ..., [side, exit]]`. The location in this instance is in the clear but could be blinded. There are trade offs and differences in playability either way.

The player calls `transcriptEntryCommit` to use the first `[side, exit]` tuple in 0x51229ba6890e9f5ce4f409cb627e88925603f9d3c415fb2f3a739feaa0b1dee7.

The guardian calls `transcriptResolveOutcome` providing a stack of merkle proofs proving that the players choice of `[side, exit]` at the current location leads to a specific new location and a new set of choices. To achieve this, the merkle trie encodes a variety of leaf nodes in a specific structure that enable on chain enforcement of fair choice outcomes.

The types for normal navigation are currently

1. `{LOCATION_CHOICE, [[locationId], [side, exit], ..., [side, exit]]}`
2. `{EXIT, [[REF(#L, i)]]}`
3. `{LINK, [[REF(#Ea)], [REF(#Ea)]]}`

To resolve a choice a proof *stack* is created. The stack allows the leaves matching the provided proofs to be reconstructed on chain, in part from the previously committed player data `[side, exit]` and in part the *leaf encoding* of *earlier* items in the proof stack. Before considering each item in the stack, the proof for the earlier item (and the leaf value) is re-constructed on chain.

This lets us prove relations: That having chosen side 1, exit 0 at location 0, we show there exists an EXIT leaf in the merkle trie which is derived from the leaf value of the location and the specific input choice. And then having shown that, we similarly show EXIT and LOCATION's exist on the 'other end' of the choice. And finally we show there exists a LINK leaf, reconstructed from the egress exit leaf and the ingress leaf. If all of these things exist, we say the location change is fair.

So for this resolution the stack actually looks like

0. `{LOCATION_CHOICE, [[0], [1, 0], [3, 0]]}`
1. `{EXIT, [[REF(0, 1)]]}` (references the leaf value for stack 0, and input[1], skipping over the locationid)
2. `{LOCATION_CHOICE, [[8], [2, 0], [3, 0]]}`
3. `{EXIT, [[REF(2, 2)]]}` (references the leaf value for stack 0, and input[2])
4. `{LINK, [[REF(1)], [REF(3)]]}` (references only the leaf values)

The contract proves each slot in turn, reverting if any fail and back referencing earlier results to derive the reference nodes.

The gory details can be found in [libproofstack.sol#check](https://github.com/polysensus/chaintrap-contracts/blob/main/lib/libproofstack.sol#L90) and also in [libtranscript.sol#entryReveal](https://github.com/polysensus/chaintrap-contracts/blob/main/lib/libtranscript.sol#L466)


In `0x6c43bf179cfe1809d161642ed314860941f549f6e0f15ff8cc7b107e9a380576` the player calls `transcriptEntryCommit` again, with the same effect as before.

The guardian then calls `transcriptEntryResolve` in `0x5333a2c90bd4acd513c42d071d9c01eea0423aabe184ac552f4ee78218316d52` but this time, the guardian can't proof a location change because the player has found and selected the finish.

At the creation of the game the various proof stack 'transition' types are committed as part of the session definition. The contracts require that there is at least one 'victory' transition type. In this transaction, it is a victory transition that is provided. The rules for victory transitions are different - there is no 'next set of choices' to link to. The guardian simply proves that the finish exists and is linked to the choice inputs selected by the player.

With no real game specific semantics, the contracts can fairly close the game and transfer ownership of the game session nft to the victorious player.

We plan to enable some cool things for players how can demonstrate they 'trapped' there fellow trialists in the dungeon by reaching the finish first!


### D. On victory, the game nft is transferred to the winner

We did not initially plan to do rewards and nft transfer until CMS 5, but transferring the game session nft to the victor was just to tempting to pass up. It gives us a very simple but complete experience.

The javascript library will not create a game unless a 'finish' is provided.

### chaintrap integration tests

