require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  settins: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },

  // defaultNetwork: "localhost",
  networks: {
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_URL,
      accounts: [
        process.env.SEPOLIA_ADMIN_PRIVATE_KEY,
        process.env.SEPOLIA_OWNER_PRIVATE_KEY,
        process.env.SEPOLIA_BUYER_PRIVATE_KEY,
      ],
      blockConfirmations: 6,
      chainId: 11155111,
      saveDeployments: true,
    },
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      chainId: 31337,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY,
  },
  gasReporter: {
    enabled: false,
    outputFile: "gas_reporter.txt",
    noColors: true,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_KEY,
    token: "ETH", //To get a gas report on the ethereum network.
  },

  namedAccounts: {
    admin: {
      default: 0,
    },
    owner: {
      default: 1,
    },
    buyer: {
      default: 2,
    },
  },
  mocha: {
    setTimeout: 120000,
  },
};
