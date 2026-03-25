# StealthFlow: Private Condition Wallet

StealthFlow is a privacy-first Web3 decentralized application designed for scheduling conditional payments. It leverages Fully Homomorphic Encryption (FHE) to ensure that transaction amounts remain completely obscured on the public ledger during their lockup period. StealthFlow was engineered to integrate directly with the Fhenix CoFHE coprocessor architecture.

## Architecture and Use Case

Traditional Ethereum escrow contracts publicly expose the transferred amount (`msg.value`) and the internal contract state. StealthFlow solves this by natively encrypting the transaction volume client-side and processing the conditional release logic homomorphically on-chain. 

Funds are held in an escrow smart contract and released to the recipient only after a programmatic time condition is met. Throughout this lifecycle, the exact financial volume involved in the transaction is cryptographically concealed from all intermediate nodes, block explorers, and unauthorized third parties.

## Technology Stack

The application is structured into a distinct frontend interface and a smart contract backend, utilizing the following technologies:

| Layer | Technology |
|---|---|
| **Frontend Framework** | React + TypeScript, Vite |
| **Routing** | Wouter |
| **Styling** | Tailwind CSS, Radix UI |
| **Web3 Provider** | Ethers.js v6 |
| **Homomorphic Encryption** | Fhenix (`@fhenixprotocol/cofhejs`) |
| **Smart Contracts** | Solidity, Foundry / Hardhat |
| **FHE Coprocessor** | `@fhenixprotocol/cofhe-contracts` |
| **Network** | Ethereum Sepolia (Chain ID 11155111) |

## Fhenix FHE Integration

StealthFlow achieves true mathematical privacy by integrating the Fhenix Confidential Computing Framework for Homomorphic Encryption (CoFHE).

1. **Client-Side Encryption:** The frontend application natively imports `cofhejs/web`. When a user authorizes a payment, the application generates a secure `InEuint64` FHE payload within the browser memory. This ciphertext is transmitted to the smart contract, ensuring plaintext `msg.value` expectations are never logged on RPC nodes.
2. **On-Chain Computation:** The `StealthWallet.sol` smart contract imports `FHE.sol`. It stores the encrypted payment values as `euint64` primitives. Access control is strictly enforced using `FHE.allow()`, granting decryption permissions solely to the sender, the recipient, and the contract itself.
3. **Decryption Escrow Flow:** Web3 cannot natively decrypt homomorphic encryption blobs in a single synchronous transaction. Consequently, StealthFlow utilizes the CoFHE two-step decryption pattern: issuing an asynchronous decryption request via `FHE.decrypt()` to the CoFHE off-chain oracle, and seamlessly fulfilling the finalized payload execution natively.

## The Privacy Boundary

Understanding the privacy boundary is critical for evaluating StealthFlow:
* **Pre-Execution (100% Private):** While the funds are locked in the contract awaiting their timestamp condition to be met, the balance is perfectly encrypted via FHE. Neither block explorers nor RPC nodes can deduce the underlying amount.
* **Execution Transfer (Unsealed):** Because StealthFlow utilizes native Ethereum (ETH) for transfers using `recipient.call`, the FHE amount must be unsealed at the atomic moment of execution to adjust native network balances. This is inherently public on the blockchain explorer's Internal Transactions tab. Full execution privacy would require transitioning to an FHE-ERC20 token standard, which is a target for V2.

## Smart Contract Functions

**Contract Name:** `StealthWallet.sol`  
**Network:** Ethereum Sepolia (Chain ID 11155111)  
**Deployed Address:** `0x7091056ca13fd6a2e09d0bc4944e87a0b6b909cb`

| Function | Access | Description |
|---|---|---|
| `setPayment` | Public | Schedules a new conditional payment. Accepts the `InEuint64` FHE payload, the unlock timestamp, and the recipient address. |
| `requestDecryptAmount` | Sender | Initiates the asynchronous CoFHE decryption request for a specific payment ID whose time-lock condition has resolved. |
| `executePayment` | Sender | Finalizes the execution after the CoFHE oracle fulfills the decryption request. Physically transfers escrowed ETH to the recipient. |

### Technical Constraints Imposed
* **60-Second Minimum Lock:** Due to block mining lifecycles on the Sepolia Testnet (12-15s blocks), any delay less than 60 seconds risks expiring before transaction inclusion, leading to contract reverts. The UI rigorously enforces this.
* **Oracle Decryption Polling:** When requesting decryption, the Fhenix Co-processor network requires approximately 15-30 seconds to return the callback block. The frontend incorporates dynamic `staticCall` polling to wait for the exact moment the oracle unseals the value before prompting the user for the final `executePayment` transaction.

## Transaction Workflow

1. **Encrypt:** Browser encrypts the ETH amount using the Fhenix CoFHE public key, generating an `InEuint64` tuple.
2. **Schedule:** The ciphertext, lock condition, and `msg.value` are submitted. The contract assigns a unique Payment ID.
3. **Await:** The contract enforces the chronological condition. The `euint64` value remains obscured.
4. **Decrypt:** The sender triggers `requestDecryptAmount`. The network evaluates the FHE blob continuously.
5. **Execute:** The sender executes the finalized payload. The contract unseals the value and transfers the funds natively to the recipient.

## Deployment and Execution

### Local Development

1. **Install Dependencies:**  
   `npm install`
2. **Launch Frontend Environment:**  
   `npm run dev`
3. **Smart Contract Management:**  
   Navigate to `/hardhat-workspace` to interface with the Foundry deployment scripts targeting the Ethereum Sepolia network.

### Vercel Deployment

StealthFlow includes a native `vercel.json` configuration file engineered to support Vite SPA architecture and client-side Wouter routing. The application can be continuously deployed to Vercel without overriding framework presets. All network connectivity strictly binds to Ethereum Sepolia.

### MIT License
