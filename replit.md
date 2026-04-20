# StealthFlow

Confidential payment infrastructure powered by Fhenix Fully Homomorphic Encryption (FHE). Schedule time-locked private payments on Ethereum Sepolia where the payment amount stays encrypted on-chain.

## Architecture

Monorepo (pnpm workspaces):
- `artifacts/stealthflow/` — React + Vite frontend
- `lib/` — shared TypeScript libraries
- `contracts/StealthWallet.sol` — deployed smart contract on Ethereum Sepolia

**Frontend stack:** React 19, Vite 7, Tailwind CSS v4, Wouter (routing), TanStack Query, ethers.js v6, `@cofhe/sdk` (FHE encryption/decryption)

**Smart contract:** `StealthWallet.sol` deployed at `0x7091056ca13fd6a2e09d0bc4944e87a0b6b909cb` on Ethereum Sepolia. Uses `@fhenixprotocol/cofhe-contracts` (FHE.sol).

**CoFHE TaskManager:** `0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9` on Ethereum Sepolia.

## Key Features

- **FHE Encryption**: Payment amounts are encrypted in the browser using `@cofhe/sdk` before being stored on-chain
- **Time-locked**: Payments can only be released after an unlock timestamp
- **Privacy-first**: Only the sender and recipient can see payment details
- **New decrypt flow**: Uses Threshold Network v2 (client-side `decryptForTx` → `publishDecryptResult` → `executePayment`)

## SDK Migration (April 2026)

Migrated from deprecated `cofhejs` to `@cofhe/sdk v0.4.0`:

| Old (`cofhejs`) | New (`@cofhe/sdk`) |
|---|---|
| `cofhejs.initializeWithEthers()` | `createCofheClient()` + `Ethers6Adapter()` |
| `cofhejs.encrypt([Encryptable.uint64()])` | `client.encryptInputs([...]).execute()` |
| `requestDecryptAmount()` + oracle polling | `client.decryptForTx().withoutPermit().execute()` |
| Oracle-populated result | `TaskManager.publishDecryptResult()` then `executePayment()` |

## Development

```bash
pnpm install
# App runs on port 5000
cd artifacts/stealthflow && pnpm run dev
```

## Environment

- Network: Ethereum Sepolia (chainId 11155111)
- RPC: `https://ethereum-sepolia.publicnode.com`
- No environment variables required for frontend
