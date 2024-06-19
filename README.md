# PropChain

# Abokobi Property Registry and Mnagement System

## Overview

Welcome to the Abokobi Property Registry and Management System. This project aims to revolutionize the way property management is conducted in the Abokobi district by transitioning from traditional paper-based and spreadsheet systems to a modern blockchain-based solution.

## Problem Statement

After conducting extensive research in the Abokobi district, it became evident that the current methods of land management and storage rely heavily on spreadsheets and paper systems. These methods are prone to errors, inefficiencies, and lack of transparency. There is a pressing need for a reliable, secure, and transparent system to manage property registrations and ransactions.

## Solution

The Abokobi Property Registry and Auction System leverages blockchain technology to address the challenges faced in the current system. By using smart contracts, we ensure that property records are immutable, transparent, and easily accessible. The system facilitates property management, registration, verification, auctioning, and transactions in a secure and automated manner.

## Smart Contracts

### PropertyRegistry.sol

This contract handles the registration, verification and ownership transfers, amongst others. It extends itself with the Auction contract to include auctioning and bidding functionalities.

- **registerProperty**: Registers a new property.
- **verifyProperty**: Verifies a registered property.
- **updatePropertyPrice**: Updates the price of a registered property.
- **createAuction**: Creates an auction for a registered property.
- **endAuction**: Ends an auction for a registered property.
- **cancelAuction**: Cancels an auction for a registered property.
- **initiateTransaction**: Initiates a transaction for a property.
- **confirmTransaction**: Confirms a transaction by the buyer or seller.
- **adminConfirmTransaction**: Admin confirms a transaction and completes it.

### Auction.sol

This contract manages the auctioning of properties. It implements Chainlink AutomationCompatible for automated auction management.

- **checkUpkeep**: Checks if any auction needs to be ended.
- **performUpkeep**: Performs upkeep to end auctions.
- **createAuction**: Creates a new auction for a property.
- **placeBid**: Places a bid on an active auction.
- **endAuction**: Ends an active auction.
- **cancelAuction**: Cancels an active auction.
- **getAuctionDetails**: Gets details of an auction.
- **getHighestBidder**: Gets the highest bidder of an auction.
- **withdraw**: Withdraws pending returns.

## Getting Started

### Requirements

To set up and use the Lottery Smart Contract, you'll need the following:

- `git`
- `Node.js`
- `Yarn` (instead of npm)

Make sure you have these tools installed by running `git --version`, `node --version`, and `yarn --version`.

### Quickstart

1. Clone the repository:

   ```bash
   git clone https://github.com/Mr-Saade/Hardhat-Lottery
   cd Hardhat-Lottery
   ```

2. Install dependencies:

```bash
yarn
```

## Usage

### Deploying

Deploy the Lottery Smart Contract using the following command:

```bash
yarn hardhat deploy
```

### Testing

Run tests to ensure the contract's functionality:

```bash
yarn test
```

### Test Coverage

Generate a test coverage report:

```bash
yarn coverage
```

### Deployment to Testnet or Mainnet

1. Set up environment variables using `.env` file (see [Environment Variables](#environment-variables)).
2. Deploy the contract to the desired network:

```bash
yarn hardhat deploy --network yourNetwork
```

## Configuration

### Environment Variables

Create a `.env` file with the following environment variables:

- `PRIVATE_KEY`: Private key of your Ethereum account (from Metamask).
- `SEPOLIA_RPC_URL`: URL of the Sepolia testnet node.
- `COINMARKETCAP_API_KEY`: API key from CoinMarketCap for gas cost estimation.
- `ETHERSCAN_API_KEY`: API key from Etherscan for contract verification.

### Register Chainlink Keepers Upkeep

1. Set up Chainlink Keepers and register an upkeep.
2. Configure the trigger mechanism as "Custom logic".

## Estimate Gas Cost in USD

For a USD estimation of gas cost, set up `COINMARKETCAP_API_KEY` environment variable (see [Environment Variables](#environment-variables)). Set `enabled` to `true` in the `gasReporter` section of the `hardhat-config.js` to have a gas-reporter file generated when you run tests on the contracts.

## Verify on Etherscan

To verify the contract on Etherscan manually, set up `ETHERSCAN_API_KEY` environment variable (see [Environment Variables](#environment-variables)). Use the following command:

```bash
yarn hardhat verify --constructor-args arguments.js DEPLOYED_CONTRACT_ADDRESS
```

## Linting

Check and fix code formatting using the following commands:

```bash
yarn lint
yarn lint:fix
```

## THANK YOU.
