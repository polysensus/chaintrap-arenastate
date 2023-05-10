/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomicfoundation/hardhat-chai-matchers");
require("hardhat-deploy");
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  // defaultNetwork: "polygon_mumbai",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      chainId: 31337,
      gas: "auto",
      gasPrice: 0,
      initialBaseFeePerGas: 0,
    },
  },
  namedAccounts: {
    deployer: 10,
  },
  solidity: {
    version: "0.8.9",
    settings: {
      // hh does not support re-mappings yet
      optimizer: {
        enabled: true,
        runs: 20,
      },
    },
  },
  paths: {
    // using hardhat-foundry to get hh to work with foundry & get the benefit
    // of source remappings. this means using sources here is redundant.
    // sources: "chaintrap",
    tests: "./test",
    cache: "./test/cache",
    artifacts: "test/artifacts",
  },
  mocha: {
    spec: ["test/**/*.js", "src/**/*.mocha.js"],
    watch: true,
    "watch-files": ["test/lib/**/*.js", "test/**/*.js", "src/**/*.mocha.js"],
    "watch-ignore": ["src/**/*.spec.js"],
  },
};
