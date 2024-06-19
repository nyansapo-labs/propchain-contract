const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const { developmentChains } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
  ? describe.skip
  : describe("PropertyRegistry and Auction Staging Tests", function () {
      let propertyRegistry,
        buyer,
        owner,
        admin,
        location,
        gpsAddress,
        ipfsHash,
        startingPrice,
        auctionEndTime,
        bidAmount;

      this.timeout(240000); // Increase global timeout to 4 minutes

      beforeEach(async () => {
        const accounts = await ethers.getSigners();
        admin = accounts[0];
        owner = accounts[1];
        buyer = accounts[2];
        location = "Test5 Location";
        gpsAddress = "1991";
        ipfsHash = "QmHashh";
        startingPrice = ethers.parseEther("0.001");
        auctionEndTime = 90; // 90 seconds from now
        bidAmount = ethers.parseEther("0.005");

        propertyRegistry = await ethers.getContractAt(
          "PropertyRegistry",
          "0x47D6700AB06CC3efEE5320278DE397A8D37A3929",
          admin
        );
        console.log(
          "PropertyRegistry deployed at: ",
          await propertyRegistry.getAddress()
        );
      });

      describe("PropertyRegistry and Auction Events and Keepers", () => {
        this.timeout(200000);
        it("should work with live Chainlink Keepers for automation", async function () {
          // Listen for AuctionEnded event
          await new Promise(async (resolve, reject) => {
            propertyRegistry.once(
              "AuctionEnded",
              async (propertyAddress, highestBidder, highestBid) => {
                try {
                  console.log("AuctionEnded!");
                  const transaction = await propertyRegistry.transactions(
                    gpsAddress
                  );
                  expect(transaction.buyer).to.equal(buyer.address);
                  expect(transaction.seller).to.equal(owner.address);
                  expect(transaction.isActive).to.be.true;

                  // Confirm transaction by buyer and seller
                  await propertyRegistry
                    .connect(admin)
                    .confirmTransaction(gpsAddress);
                  await propertyRegistry
                    .connect(owner)
                    .confirmTransaction(gpsAddress);

                  // Admin confirms transaction
                  await propertyRegistry
                    .connect(buyer)
                    .adminConfirmTransaction(gpsAddress, "NewDocumentHash");

                  // Check if transaction is completed
                  const updatedProperty = await propertyRegistry.properties(
                    gpsAddress
                  );
                  expect(updatedProperty.owner).to.equal(buyer.address);
                  expect(updatedProperty.ipfsHash).to.equal("NewDocumentHash");
                  expect(propertyAddress).to.equal(gpsAddress);
                  expect(highestBidder).to.equal(buyer.address);
                  expect(highestBid.toString()).to.equal(bidAmount.toString());
                  resolve();
                } catch (error) {
                  reject(error);
                }
              }
            );

            console.log("Registering property...");
            const registerTx = await propertyRegistry
              .connect(owner)
              .registerProperty(location, gpsAddress, ipfsHash);

            await registerTx.wait(1);
            console.log("Property registered.");

            console.log("Verifying property...");
            const verifyTx = await propertyRegistry
              .connect(admin)
              .verifyProperty(gpsAddress);
            await verifyTx.wait(1);
            console.log("Property verified.");

            console.log("Creating auction...");
            const createAuctionTx = await propertyRegistry
              .connect(owner)
              .createAuction(gpsAddress, startingPrice, auctionEndTime); //owner as the seller
            await createAuctionTx.wait(1);
            console.log("Auction created.");

            console.log("Placing bid...");
            const placeBidTx = await propertyRegistry
              .connect(buyer)
              .placeBid(gpsAddress, { value: bidAmount }); //buyer as the buyer
            await placeBidTx.wait(1);
            console.log("Bid placed.");

            console.log("Waiting for event listener...");
          });
        });
      });
    });
