# StealthFlow

Privacy-first confidential payment infrastructure on Ethereum Sepolia, powered by Fhenix Fully Homomorphic Encryption (FHE).

Schedule time-locked payments where the amount stays fully encrypted on-chain — from creation through execution. Nobody except the sender and recipient can see what was transferred.

(https://sepolia.etherscan.io/address/0x7091056ca13fd6a2e09d0bc4944e87a0b6b909cb) on Ethereum Sepolia

---

## What it does

- **Encrypted amounts** — Payment values are FHE-encrypted in the browser before any data leaves your device. The on-chain ciphertext reveals nothing to observers.
- **Time-locked release** — Funds are held in the smart contract and only executable after a configurable unlock time (1 min to 30 days).
- **ENS support** — Send to any `.eth` name; it resolves to an address automatically.
- **Private memos** — Attach an optional label to any payment. Stored only on your device, never on-chain.
- **Payment request links** — Generate a shareable URL that pre-fills the Create form with your address as recipient. Anyone can open it and pay you in one click.
- **Privacy proof** — The landing page shows side-by-side what Etherscan sees (an opaque ciphertext) vs. what you see in the app (the actual payment details).

---

## How it works

```
User enters amount
       ↓
FHE encrypt in browser (@cofhe/sdk — Threshold FHE)
       ↓
setPayment(ctHash, unlockTime, recipient) + ETH → StealthWallet.sol
       ↓
[time passes]
       ↓
decryptForTx → Threshold Network returns (decryptedValue, signature)
       ↓
publishDecryptResult → CoFHE TaskManager on-chain
       ↓
executePayment() → contract reads result via getDecryptResultSafe → transfers ETH
```

The smart contract never sees a plaintext amount. It operates entirely on the encrypted ciphertext and reads the decryption result only at the moment of execution.

---

## Tech stack

| Layer | Technology |
|---|---|
| FHE encryption | `@cofhe/sdk v0.4.0` (Threshold FHE) |
| Smart contract | Solidity + `FHE.sol` (Fhenix CoFHE) |
| Network | Ethereum Sepolia (chainId 11155111) |
| Frontend | React 19 + Vite 7 + TypeScript |
| Web3 | Ethers.js v6 + `Ethers6Adapter` → viem |
| ENS resolution | Ethers.js v6 mainnet provider |
| UI | Tailwind CSS v4 + Lucide React + Framer Motion |
| Package manager | pnpm (monorepo) |

---

## SDK migration (Wave 2)

The original `cofhejs` library and its oracle-based decryption infrastructure were deprecated by Fhenix during the buildathon. StealthFlow was migrated to `@cofhe/sdk v0.4.0` without redeploying the contract.

| Old (`cofhejs`) | New (`@cofhe/sdk`) |
|---|---|
| `cofhejs.initializeWithEthers()` | `createCofheClient()` + `Ethers6Adapter()` |
| `cofhejs.encrypt([Encryptable.uint64()])` | `client.encryptInputs([...]).execute()` |
| `requestDecryptAmount()` + 15–30s oracle poll | `client.decryptForTx().withoutPermit().execute()` |
| Oracle publishes result | Client calls `TaskManager.publishDecryptResult()` |

The contract's `FHE.getDecryptResultSafe()` works identically with both flows — no redeployment needed.

---

## Project structure

```
artifacts/stealthflow/
├── contracts/
│   └── StealthWallet.sol          # Deployed FHE smart contract
├── src/
│   ├── lib/
│   │   ├── contract.ts            # ABI, addresses, formatters
│   │   ├── wallet.ts              # MetaMask connection
│   │   ├── ens.ts                 # ENS name resolution (mainnet)
│   │   ├── labels.ts              # Local payment memos (device-only)
│   │   ├── txStorage.ts           # Local tx hash persistence
│   │   ├── historyStorage.ts      # Cached payment history
│   │   └── paymentStatus.ts       # Payment status derivation
│   ├── pages/
│   │   ├── Landing.tsx            # Hero + privacy proof panel
│   │   ├── Create.tsx             # New payment form (ENS, memo, request link)
│   │   ├── Dashboard.tsx          # Payment list with live countdowns
│   │   ├── Execute.tsx            # Threshold decrypt + execute flow
│   │   └── Receipts.tsx           # Executed payment receipts
│   └── components/
│       ├── Navbar.tsx
│       ├── WalletGate.tsx
│       └── PrivacyModal.tsx
└── vite.config.ts
```

---

## Development

```bash
# Install dependencies (from repo root)
pnpm install

# Start dev server
cd artifacts/stealthflow && pnpm run dev
# Runs on http://localhost:5000
```

Requires MetaMask connected to **Ethereum Sepolia**. No API keys or environment variables needed.

---

## Contract addresses (Ethereum Sepolia)

| Contract | Address |
|---|---|
| StealthWallet | `0x7091056ca13fd6a2e09d0bc4944e87a0b6b909cb` |
| CoFHE TaskManager | `0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9` |

---

## Roadmap

- **FHE-ERC20 architecture** — Replace native ETH with `FHE.add`/`FHE.sub` so amounts stay encrypted even during transfer
- **ERC-5564 stealth addresses** — One-time recipient addresses so sender-recipient pairs are unlinkable
- **Paymaster/relayer** — Remove the need for senders to hold ETH; privacy from day one
- **Signed payment requests** — Upgrade the URL-based request link to a verifiable signed standard

---

## License

MIT
