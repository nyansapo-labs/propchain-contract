const { ethers } = require("hardhat");

async function main() {
  const accounts = await ethers.getSigners();
  const admin = accounts[0];
  const user = accounts[1];
  const buyer = accounts[2];
  const buyer2 = accounts[3];
  const propertyRegistry = await ethers.getContractAt(
    "PropertyRegistry",
    "0xEbF68D0316F5Ca8dbeD956e4f1bF709490E53166",
    user
  );

  // Register two properties
  const tx1 = await propertyRegistry.registerProperty(
    "123 Main St",
    "GPS1234",
    "QmHash1"
  );
  await tx1.wait();
  console.log("Property 1 registered: 123 Main St, GPS1234, QmHash1");

  const tx2 = await propertyRegistry.registerProperty(
    "456 Elm St",
    "GPS5678",
    "QmHash2"
  );
  await tx2.wait();
  console.log("Property 2 registered: 456 Elm St, GPS5678, QmHash2");

  const adminContract = await propertyRegistry.connect(admin);

  // Verification of property bu admin.
  const tx3 = await adminContract.verifyProperty("GPS1234");
  await tx3.wait();
  console.log("Property 1 verified: GPS1234");

  // Auction creation

  const auctionTx = await propertyRegistry.connect(user).createAuction(
    "GPS1234",
    ethers.parseEther("1"),
    60 * 60 * 24 // 1 day in seconds
  );
  await auctionTx.wait();
  console.log("Auction created for property: GPS1234");

  // Place bids
  const buyerContract = await propertyRegistry.connect(buyer);

  const bidTx1 = await buyerContract.placeBid("GPS1234", {
    value: ethers.parseEther("1.5"),
  });
  await bidTx1.wait();
  console.log("Bid placed by buyer 1: 1.5 ETH");

  // Another user placing a bid

  const buyer2Contract = await propertyRegistry.connect(buyer2);

  const bidTx2 = await buyer2Contract.placeBid("GPS1234", {
    value: ethers.parseEther("2"),
  });
  await bidTx2.wait();
  console.log("Bid placed by buyer 2: 2 ETH");

  // Withdraw bids
  //Buyer 1 can now withdraw their bid since they were outbid by buyer 2
  const withdrawTx = await buyerContract.withdraw();
  await withdrawTx.wait();
  console.log("Buyer 1 withdrew their bid");

  // End auction manually (simulating Chainlink Keeper)
  const { upkeepNeeded, performData } = await propertyRegistry.checkUpkeep(
    "0x"
  );
  if (upkeepNeeded) {
    const txResponse = await propertyRegistry.performUpkeep(performData);
    await txResponse.wait();
    console.log("Auction ended for property: GPS1234");
  } else {
    console.log("No upkeep needed");
  }

  // Confirm transaction by buyer and seller
  const confirmTx = await propertyRegistry
    .connect(buyer2)
    .confirmTransaction("GPS1234");
  await confirmTx.wait();
  console.log("Transaction confirmed by buyer 2 for property: GPS1234");

  const confirmTx2 = await propertyRegistry
    .connect(user)
    .confirmTransaction("GPS1234");
  await confirmTx2.wait();
  console.log("Transaction confirmed by seller for property: GPS1234");

  // Admin finalizes transaction
  const adminFinalTx = await adminContract.adminConfirmTransaction(
    "GPS1234",
    "QmNewHash"
  );
  await adminFinalTx.wait();

  // Property ownership transfer
  const newPropertyOwner = await propertyRegistry.properties("GPS1234").owner;
  console.log("New property owner:", newPropertyOwner);

  // Property documents updated
  const updatedPropertyDocs = await propertyRegistry.properties("GPS1234")
    .ipfsHash;
  console.log("Updated Property Docs:", updatedPropertyDocs);

  console.log(
    "Transaction finalized by admin, property documents updated with new owner details: GPS1234"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
