# Integration tests

These require hardhat.

Some tests are able to execute against optimism and polygon testnets. Such tests
self configure based on provided environment.

Some tests require live services, for example the map generation service.

The basis of test self configuration can be found in src/lib/envopts and test/mocha-root-hooks.js

The organisation here is:

## /test/support

general test support facilities

## test/<directory>

where <directory> matches src/<directory> contains integration tests for that src directory sources. Eg., test/mint covers new game creation via GameMint.

## test/libtranscript

hardhat tests of the LibTranscript solidity from chaintrap-contracts. This will likely move
