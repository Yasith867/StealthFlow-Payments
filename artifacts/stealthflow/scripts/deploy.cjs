/**
 * deploy.cjs — StealthWallet.sol deployment script
 * Run: npx hardhat run scripts/deploy.cjs --network localhost
 *      npx hardhat run scripts/deploy.cjs --network fhenixHelium
 */
const { ethers, network } = require("hardhat");

async function main() {
  console.log("=".repeat(50));
  console.log("  StealthFlow — Private Condition Wallet");
  console.log(`  Deploying StealthWallet.sol to ${network.name}...`);
  console.log("=".repeat(50));

  const [deployer] = await ethers.getSigners();
  console.log(`\nDeployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error("\nERROR: Balance is 0. Fund wallet before deploying.");
    process.exit(1);
  }

  const StealthWallet = await ethers.getContractFactory("StealthWallet");
  const contract = await StealthWallet.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log("\n" + "=".repeat(50));
  console.log("  DEPLOYMENT SUCCESSFUL");
  console.log("=".repeat(50));
  console.log(`\nContract: ${address}`);
  console.log(`Network:  ${network.name}`);
  console.log(`Owner:    ${deployer.address}`);
  console.log("\nSTEALTHFLOW_CONTRACT_ADDRESS=" + address);
  console.log("=".repeat(50));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
