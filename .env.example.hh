# This example is used by the cd. The variables are envsubsted in from
# pipeline secrets

export ARENASTATE_LOGLEVEL=DEBUG
export ARENASTATE_PROVIDER_URL="http://localhost:8545"

# hardhat - in process, leaving the test setup to deploy the contracts
# DONT export ARENASTATE_ARENA - absence is the switch to make it in process
export ARENASTATE_DEPLOY_KEY=hardhat:0
export ARENASTATE_OWNER_KEY=hardhat:1
export ARENASTATE_GUARDIAN_KEY=hardhat:10
export ARENASTATE_USER1_KEY=hardhat:11
export ARENASTATE_USER2_KEY=hardhat:12
export ARENASTATE_USER3_KEY=hardhat:13
export ARENASTATE_USER4_KEY=hardhat:14

# Note: the $VAR's allow this file to act as an envsubst template for the cd
export ARENASTATE_NFTSTORAGE_API_KEY=$ARENASTATE_NFTSTORAGE_API_KEY
export ARENASTATE_OPENAI_API_KEY=$ARENASTATE_OPENAI_API_KEY

export ARENASTATE_NFTSTORAGE_URL=https://api.nft.storage
export ARENASTATE_OPENAI_IMAGES_URL=https://api.openai.com/v1/images/generations
export ARENASTATE_MAPTOOL_URL=https://chaintrap.hoy.polysensus.io/chaintrap/maptool/commit/
export ARENASTATE_MAPTOOL_IMAGE=eu.gcr.io/hoy-dev-1/chaintrap-maptool:main-20
export ARENASTATE_MAPTOOL_IMAGE_DIGEST=sha256:9806aaeb3805f077753b7e94eae2ba371fd0a3cc64ade502f6bc5a99a9aba4e9
