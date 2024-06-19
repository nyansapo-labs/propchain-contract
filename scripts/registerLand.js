const { ethers } = require("hardhat");

async function main() {
  const accounts = await ethers.getSigners();
  const admin = accounts[0];
  const user = accounts[1];
  const propertyRegistry = await ethers.getContractAt(
    "PropertyRegistry",
    "0x47D6700AB06CC3efEE5320278DE397A8D37A3929",
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

  // Connect the admin wallet to the contract
  const adminContract = await propertyRegistry.connect(admin);

  // Verify the first property
  const tx3 = await adminContract.verifyProperty("GPS1234");
  await tx3.wait();
  console.log("Property 1 verified: GPS1234");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
