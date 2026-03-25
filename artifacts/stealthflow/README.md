# StealthFlow — Private Condition Wallet

A privacy-first Web3 dApp that lets you schedule payments with **encrypted amounts** using Fhenix's Fully Homomorphic Encryption (FHE).

## What is FHE?

**Fully Homomorphic Encryption (FHE)** is a form of encryption that allows computations to be performed directly on encrypted data — without decrypting it first.

In StealthFlow:
- Your payment amount is **encrypted on the client side** before it ever leaves your browser
- The encrypted value is stored on the Fhenix blockchain
- The smart contract uses the encrypted value internally — it **never knows the plaintext amount**
- No miner, validator, or observer can determine the payment amount

## How Encryption Works in This App

1. You enter an amount (e.g., `0.5 ETH`)
2. The frontend encrypts it into a `euint64` ciphertext using Fhenix's FHE library
3. The ciphertext is sent to the `StealthWallet` contract via `setPayment()`
4. The contract stores `encryptedAmount` — an opaque blob that hides the real value
5. When the time condition is met and `executePayment()` is called, the encrypted amount is used without being decrypted

## Why Amounts Are Private

Traditional smart contracts store all data in plaintext — anyone can read any state variable. Fhenix's CoFHE (Collaborative Fully Homomorphic Encryption) changes this: certain variables are encrypted at the protocol level, making them unreadable even to node operators.

This means:
- Competitors can't see how much you're paying
- Recipients can't front-run the payment
- Network observers learn nothing about value flows

---

## Project Structure

```
StealthFlow/
├── contracts/
│   └── StealthWallet.sol      # FHE-encrypted smart contract
├── scripts/
│   └── deploy.js              # Hardhat deployment script
├── src/
│   ├── lib/
│   │   ├── contract.ts        # ABI, address, encryption helpers
│   │   └── wallet.ts          # MetaMask connection helpers
│   └── pages/
│       └── Home.tsx           # Main UI
├── hardhat.config.js          # Hardhat configuration
└── .env.example               # Environment variable template
```

---

## Setup & Deployment

### 1. Install dependencies

```bash
# Root monorepo
pnpm install

# Contract dependencies (in artifacts/stealthflow)
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your PRIVATE_KEY
```

### 3. Compile the contract

```bash
npx hardhat compile
```

### 4. Get test ETH

- **Fhenix Helium faucet**: https://faucet.helium.fhenix.zone
- Paste your wallet address and request test tokens

### 5. Deploy to Fhenix Helium Testnet

```bash
npx hardhat run scripts/deploy.js --network fhenixHelium
```

### 6. Update contract address

Copy the printed contract address and update:

```typescript
// src/lib/contract.ts
export const CONTRACT_ADDRESS = "0xYourDeployedAddress";
```

### 7. Run the frontend

```bash
# From the repo root
pnpm --filter @workspace/stealthflow run dev
```

---

## Smart Contract Reference

### `StealthWallet.sol`

| Function | Description |
|----------|-------------|
| `setPayment(euint64, uint256, address)` | Schedule a payment. Owner only. Amount is FHE-encrypted. |
| `executePayment()` | Execute payment when `block.timestamp >= unlockTime`. |
| `canExecute()` | Returns true if payment is ready to execute. |
| `timeUntilUnlock()` | Seconds remaining until unlock. |

### Events

| Event | When |
|-------|------|
| `PaymentScheduled(address, uint256)` | Payment is successfully scheduled |
| `PaymentExecuted(address)` | Payment is executed |

---

## Networks

| Network | Chain ID | RPC |
|---------|----------|-----|
| Fhenix Helium (primary) | 8008135 | https://api.helium.fhenix.zone |
| Base Sepolia (no FHE) | 84532 | https://sepolia.base.org |
| Hardhat Local | 31337 | http://127.0.0.1:8545 |

---

## Security

- The `encryptedAmount` state variable is declared `private` — Solidity prevents direct reads
- The `onlyOwner` modifier restricts `setPayment()` to the contract owner
- Checks-effects-interactions pattern is used in `executePayment()` to prevent reentrancy
- Amounts are never decrypted inside the contract

## License

MIT
