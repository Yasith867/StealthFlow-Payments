import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import * as fs from 'fs'
import * as path from 'path'

// Helper to save deployment outputs
export function saveDeployment(network: string, contractName: string, address: string) {
	const deploymentsDir = path.join(__dirname, '..', 'deployments')
	if (!fs.existsSync(deploymentsDir)) {
		fs.mkdirSync(deploymentsDir)
	}

	const networkDir = path.join(deploymentsDir, network)
	if (!fs.existsSync(networkDir)) {
		fs.mkdirSync(networkDir)
	}

	const file = path.join(networkDir, `${contractName}.json`)
	fs.writeFileSync(
		file,
		JSON.stringify(
			{
				address,
				timestamp: new Date().toISOString(),
			},
			null,
			2,
		),
	)
}

task('deploy-stealthwallet', 'Deploy the StealthWallet contract').setAction(async (_, hre: HardhatRuntimeEnvironment) => {
	const { ethers, network } = hre

	console.log(`Deploying StealthWallet to ${network.name}...`)

	// Get the deployer account
	const [deployer] = await ethers.getSigners()
	console.log(`Deploying with account: ${deployer.address}`)

    const balance = await ethers.provider.getBalance(deployer.address)
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`)
    
    if (balance === 0n) {
        console.error('Wallet is empty! Cannot deploy.')
        return
    }

	// Deploy the contract
	const Contract = await ethers.getContractFactory('StealthWallet')
	const contract = await Contract.deploy()
	await contract.waitForDeployment()

	const address = await contract.getAddress()
	console.log(`StealthWallet deployed to: ${address}`)

	saveDeployment(network.name, 'StealthWallet', address)
    
    // Auto update the frontend file
    const contractTsPath = path.join(__dirname, '..', '..', 'src', 'lib', 'contract.ts')
    if (fs.existsSync(contractTsPath)) {
        let content = fs.readFileSync(contractTsPath, 'utf8')
        content = content.replace(/export const CONTRACT_ADDRESS = "[^"]*";/, `export const CONTRACT_ADDRESS = "${address}";`)
        fs.writeFileSync(contractTsPath, content)
        console.log(`Updated frontend at ${contractTsPath}`)
    }

	return address
})
