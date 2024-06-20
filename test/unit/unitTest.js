const { deployments, ethers, network } = require("hardhat");
const { assert, expect } = require("chai");
const { developmentChains } = require("../../helper-hardhat-config");
const { moveTime } = require("../../utils/moveTime");
const { moveBlocks } = require("../../utils/moveBlocks");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("PropertyRegistry and Auction Unit Tests", function () {
      let propertyRegistry, admin, user, buyer, seller, owner;
      const location = "Test Location";
      const gpsAddress = "1234";
      const ipfsHash = "QmHash";
      const startingPrice = ethers.parseEther("0.001");
      const auctionEndTime = 30; // 1 hour from now
      const newPrice = ethers.parseEther("0.002");
      const bidAmount = ethers.parseEther("0.005");
      const nonExistingGPS = "5678";
      const listingFee = (1 / 100) * Number(startingPrice);

      const transactionFee = (1 / 100) * Number(bidAmount);

      beforeEach(async () => {
        const accounts = await ethers.getSigners();
        admin = accounts[0];
        user = accounts[1];
        buyer = accounts[2];
        seller = accounts[3];
        owner = accounts[4];

        await deployments.fixture(["all"]);
        propertyRegistry = await ethers.getContractAt(
          "PropertyRegistry",
          "0x5FbDB2315678afecb367f032d93F642f64180aa3", // copy address from deployments
          admin
        );
      });

      describe("PropertyRegistry Contract", () => {
        it("won't update property price if not owner and if not registered", async () => {
          const newPrice = ethers.parseEther("2");
          await expect(
            propertyRegistry
              .connect(seller)
              .updatePropertyPrice(gpsAddress, newPrice)
          ).to.be.reverted;
          await expect(
            propertyRegistry
              .connect(owner)
              .updatePropertyPrice(gpsAddress, newPrice)
          ).to.be.reverted;
        });
        beforeEach(async () => {
          await propertyRegistry
            .connect(owner)
            .registerProperty(location, gpsAddress, ipfsHash);
        });
        it("should not be verified by default after registering a property", async () => {
          const verifiedProperty = await propertyRegistry.properties(
            gpsAddress
          );

          expect(verifiedProperty.isVerified).to.be.false;
        });

        it("should register a property", async () => {
          const property = await propertyRegistry.properties(gpsAddress);
          expect(property.owner).to.equal(owner.address);
          expect(property.location).to.equal(location);
          expect(property.ipfsHash).to.equal(ipfsHash);
        });

        it("should verify a property by admin", async () => {
          await propertyRegistry.connect(admin).verifyProperty(gpsAddress);
          const verifiedProperty = await propertyRegistry.properties(
            gpsAddress
          );
          console.log(verifiedProperty.isVerified);
          expect(verifiedProperty.isVerified).to.be.true;
        });

        it("should update property price only after auctioning but before bidding starts by registered owner for a registered property", async () => {
          // You need to create an auction before you can update the price
          await propertyRegistry
            .connect(owner)
            .createAuction(gpsAddress, startingPrice, auctionEndTime, {
              value: listingFee,
            });
          await propertyRegistry
            .connect(owner)
            .updatePropertyPrice(gpsAddress, newPrice);
          const updatedProperty = await propertyRegistry.properties(gpsAddress);
          expect(updatedProperty.price).to.equal(newPrice);
        });

        it("can create auction for a registered property", async () => {
          await propertyRegistry
            .connect(owner)
            .createAuction(gpsAddress, startingPrice, auctionEndTime, {
              value: listingFee,
            });
          const auctionItem = await propertyRegistry.auctions(gpsAddress);
          console.log(auctionItem);
          expect(auctionItem.isActive).to.be.true;
        });

        it("should not update property price after bids have been placed", async () => {
          // Place a bid to make the auction active

          await propertyRegistry
            .connect(owner)
            .createAuction(gpsAddress, startingPrice, auctionEndTime, {
              value: listingFee,
            });
          await propertyRegistry
            .connect(buyer)
            .placeBid(gpsAddress, { value: ethers.parseEther("1.5") });

          await expect(
            propertyRegistry
              .connect(owner)
              .updatePropertyPrice(gpsAddress, ethers.parseEther("3"))
          ).to.be.reverted;
        });

        it("should not create a new auction for an already active property", async () => {
          await propertyRegistry
            .connect(owner)
            .createAuction(gpsAddress, startingPrice, auctionEndTime, {
              value: listingFee,
            });
          await expect(
            propertyRegistry
              .connect(owner)
              .createAuction(gpsAddress, startingPrice, auctionEndTime, {
                value: listingFee,
              })
          ).to.be.reverted;
        });
      });

      describe("Auction Contract", () => {
        let userBalanceInitial;
        beforeEach(async () => {
          userBalanceInitial = await propertyRegistry.pendingReturns(
            user.address
          );
          console.log("userBalance: ", userBalanceInitial.toString());
          await propertyRegistry
            .connect(owner)
            .registerProperty(location, gpsAddress, ipfsHash); // owner registers property
          await propertyRegistry.connect(admin).verifyProperty(gpsAddress); // admin verifies property
          await propertyRegistry
            .connect(owner)
            .createAuction(gpsAddress, startingPrice, auctionEndTime, {
              value: listingFee,
            }); // owner creates auction
        });
        it("Contract Owwer gets funds when an auction is created and when there is a winnning bid", async () => {
          await moveTime(auctionEndTime + 1);
          await moveBlocks(1);

          const userBalance = await propertyRegistry.pendingReturns(
            user.address
          ); //user(contract owner) gets funds
          console.log("userBalance: ", userBalance.toString());
          assert(userBalance.toString() > userBalanceInitial.toString());
        });
        it("Only Owner can cancel an auction but only if there are no bids", async () => {
          await moveTime(auctionEndTime + 1);
          await moveBlocks(1);

          await propertyRegistry.connect(owner).cancelAuction(gpsAddress);

          expect(await propertyRegistry.activeAuctions(gpsAddress)).to.be.false;
        });
        it("should place a bid on an active auction", async () => {
          await propertyRegistry
            .connect(buyer)
            .placeBid(gpsAddress, { value: bidAmount }); // buyer places bid
          const highestBidder = await propertyRegistry.getHighestBidder(
            gpsAddress
          );
          expect(highestBidder).to.equal(buyer.address);
        });

        it("should end an active auction after auctionEndTime", async () => {
          await propertyRegistry
            .connect(buyer)
            .placeBid(gpsAddress, { value: bidAmount }); // buyer places bid
          // Increase time to simulate auctionEndTime
          await moveTime(auctionEndTime + 1);
          await moveBlocks(1);
          // cannot cancel auction after bid has been placed

          const { upkeepNeeded, performData } = await propertyRegistry
            .connect(owner)
            .checkUpkeep("0x");
          expect(upkeepNeeded).to.be.true;

          // Perform upkeep
          const txResponse = await propertyRegistry
            .connect(owner)
            .performUpkeep(performData);

          const txReceipt = await txResponse.wait(1);
          const auctionDetails = await propertyRegistry.getAuctionDetails(
            gpsAddress
          );

          expect(txReceipt.logs[0].args[1]).to.equal(buyer.address);

          expect(auctionDetails.isActive).to.be.false;
          expect(auctionDetails.highestBidder).to.equal(buyer.address);
        });

        it("when there is a higher bid the initial bidder should be credited in the mapping", async () => {
          const initialBuyerBalance = await ethers.provider.getBalance(
            buyer.address
          );
          console.log("initialBuyerBalance: ", initialBuyerBalance.toString());

          // Buyer places initial bid
          const buyerTx = await propertyRegistry
            .connect(buyer)
            .placeBid(gpsAddress, { value: bidAmount });
          const buyerTxReceipt = await buyerTx.wait(1);

          // Check buyer's pending returns should be 0 initially
          let buyerPendingReturns = await propertyRegistry.pendingReturns(
            buyer.address
          );
          expect(buyerPendingReturns).to.equal(0);

          // User places a higher bid
          const userTx = await propertyRegistry
            .connect(user)
            .placeBid(gpsAddress, { value: ethers.parseEther("2") });
          const userTxReceipt = await userTx.wait(1);

          // Check that buyer's pending returns is updated
          buyerPendingReturns = await propertyRegistry.pendingReturns(
            buyer.address
          );
          expect(buyerPendingReturns).to.equal(bidAmount);

          // Buyer withdraws their funds
          const withdrawTx = await propertyRegistry.connect(buyer).withdraw();
          await withdrawTx.wait(1);

          // Check that buyer's pending returns is reset to 0 after withdrawal
          buyerPendingReturns = await propertyRegistry.pendingReturns(
            buyer.address
          );
          expect(buyerPendingReturns).to.equal(0);

          // Ensure buyer's balance has increased by the bid amount (minus gas costs)
          const finalBuyerBalance = await ethers.provider.getBalance(
            buyer.address
          );
          console.log("finalBuyerBalance: ", finalBuyerBalance.toString());
          assert(finalBuyerBalance.toString() > initialBuyerBalance.toString());
        });

        it("should not allow placing bids after auction ends", async () => {
          await propertyRegistry
            .connect(buyer)
            .placeBid(gpsAddress, { value: bidAmount }); // buyer places bid
          // Increase time to simulate auctionEndTime
          await moveTime(auctionEndTime + 1);
          await moveBlocks(1);

          await expect(
            propertyRegistry
              .connect(user)
              .placeBid(gpsAddress, { value: ethers.parseEther("2") })
          ).to.be.reverted;
        });
      });

      describe("Transaction Handling", () => {
        beforeEach(async () => {
          await propertyRegistry
            .connect(owner)
            .registerProperty(location, gpsAddress, ipfsHash);
          await propertyRegistry.connect(admin).verifyProperty(gpsAddress);
          await propertyRegistry
            .connect(owner)
            .createAuction(gpsAddress, startingPrice, auctionEndTime, {
              value: listingFee,
            });
          await propertyRegistry
            .connect(buyer)
            .placeBid(gpsAddress, { value: bidAmount });

          await moveTime(auctionEndTime + 1);
          await moveBlocks(1);
          const { upkeepNeeded, performData } = await propertyRegistry
            .connect(owner)
            .checkUpkeep("0x");
          expect(upkeepNeeded).to.be.true;

          // Perform upkeep
          const txResponse = await propertyRegistry
            .connect(owner)
            .performUpkeep(performData);

          await txResponse.wait(1);
        });
        it("should initiate a transaction after winning an auction", async () => {
          // Check transaction details
          const transaction = await propertyRegistry.transactions(gpsAddress);
          expect(transaction.buyer).to.equal(buyer.address);
          expect(transaction.seller).to.equal(owner.address);
          expect(transaction.isActive).to.be.true;
        });

        it("should complete transaction after admin confirmation", async () => {
          // Confirm transaction by buyer
          await propertyRegistry.connect(buyer).confirmTransaction(gpsAddress);
          await propertyRegistry.connect(owner).confirmTransaction(gpsAddress);

          // Admin confirms transaction
          await propertyRegistry
            .connect(admin)
            .adminConfirmTransaction(gpsAddress, "NewDocumentHash");

          // Check if transaction is completed
          const updatedProperty = await propertyRegistry.properties(gpsAddress);
          expect(updatedProperty.owner).to.equal(buyer.address);
          expect(updatedProperty.ipfsHash).to.equal("NewDocumentHash");
        });
      });

      describe("Edge Cases and Error Handling", () => {
        it("should revert when trying to register an already registered property", async () => {
          await propertyRegistry
            .connect(owner)
            .registerProperty(location, gpsAddress, ipfsHash);
          await expect(
            propertyRegistry
              .connect(owner)
              .registerProperty(location, gpsAddress, ipfsHash)
          ).to.be.reverted;
        });

        it("should revert when trying to verify a property that is not registered", async () => {
          await expect(
            propertyRegistry.connect(admin).verifyProperty(nonExistingGPS)
          ).to.be.reverted;
        });

        it("should revert when non-admin tries to verify a property", async () => {
          await expect(
            propertyRegistry.connect(buyer).verifyProperty(gpsAddress)
          ).to.be.reverted;
        });

        it("should revert when trying to confirm a transaction by unauthorized party", async () => {
          await propertyRegistry
            .connect(owner)
            .registerProperty(location, gpsAddress, ipfsHash);
          await propertyRegistry.connect(admin).verifyProperty(gpsAddress);
          await propertyRegistry
            .connect(owner)
            .createAuction(gpsAddress, startingPrice, auctionEndTime, {
              value: listingFee,
            });
          await propertyRegistry
            .connect(buyer)
            .placeBid(gpsAddress, { value: bidAmount });

          await moveTime(auctionEndTime + 1);
          await moveBlocks(1);
          const { upkeepNeeded, performData } = await propertyRegistry
            .connect(owner)
            .checkUpkeep("0x");
          expect(upkeepNeeded).to.be.true;

          // Perform upkeep
          const txResponse = await propertyRegistry
            .connect(owner)
            .performUpkeep(performData);

          await txResponse.wait(1);
          await expect(
            propertyRegistry.connect(user).confirmTransaction(gpsAddress)
          ).to.be.reverted;
        });
      });

      describe("Withdrawal", () => {
        it("should allow the highest bidder to withdraw funds after winning an auction", async () => {
          await propertyRegistry
            .connect(owner)
            .registerProperty(location, gpsAddress, ipfsHash);
          await propertyRegistry.connect(admin).verifyProperty(gpsAddress);
          await propertyRegistry
            .connect(owner)
            .createAuction(gpsAddress, startingPrice, auctionEndTime, {
              value: listingFee,
            });
          const initialBalance = await ethers.provider.getBalance(
            buyer.address
          );
          await propertyRegistry
            .connect(buyer)
            .placeBid(gpsAddress, { value: bidAmount });

          await moveTime(auctionEndTime + 1);
          await moveBlocks(1);
          const { upkeepNeeded, performData } = await propertyRegistry
            .connect(owner)
            .checkUpkeep("0x");
          expect(upkeepNeeded).to.be.true;

          // Perform upkeep
          const txResponse = await propertyRegistry
            .connect(owner)
            .performUpkeep(performData);

          await txResponse.wait(1);

          await propertyRegistry.connect(buyer).withdraw();

          const finalBalance = await ethers.provider.getBalance(buyer.address);

          assert(finalBalance.toString() > initialBalance.toString());
        });

        it("should allow previous highest bidder to withdraw funds after being outbid", async () => {
          await propertyRegistry
            .connect(owner)
            .registerProperty(location, gpsAddress, ipfsHash);
          await propertyRegistry.connect(admin).verifyProperty(gpsAddress);
          await propertyRegistry
            .connect(owner)
            .createAuction(gpsAddress, startingPrice, auctionEndTime, {
              value: listingFee,
            });

          await propertyRegistry
            .connect(buyer)
            .placeBid(gpsAddress, { value: bidAmount }); // initial highest bid

          await propertyRegistry
            .connect(user)
            .placeBid(gpsAddress, { value: ethers.parseEther("2") }); // new higher bid

          const initialBalance = await ethers.provider.getBalance(
            buyer.address
          );

          await propertyRegistry.connect(buyer).withdraw();

          const finalBalance = await ethers.provider.getBalance(buyer.address);

          assert(finalBalance.toString() > initialBalance.toString());
        });
      });
    });
