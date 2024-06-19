//Etherscan Verification Script

const hre = require("hardhat");

const verify = async (contractAddress, args) => {
  console.log(`Verifying contract at ${contractAddress} ...`);
  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (e) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("Already Verified!");
    } else {
      console.log(e);
    }
  }
};

module.exports = { verify };
