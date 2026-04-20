/**
 * contract.ts
 *
 * Fhenix CoFHE integration on Ethereum Sepolia.
 * Migrated to @cofhe/sdk (v0.4.0) - fhenixjs/cofhejs deprecated.
 */

// Deployment address on Ethereum Sepolia
export const CONTRACT_ADDRESS = "0x7091056ca13fd6a2e09d0bc4944e87a0b6b909cb";
export const CONTRACT_DEPLOYED = true;

// CoFHE TaskManager — receives publishDecryptResult calls from the new SDK decrypt flow
export const TASK_MANAGER_ADDRESS = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
export const TASK_MANAGER_ABI = [
  "function publishDecryptResult(uint256 ctHash, uint256 result, bytes calldata signature) external",
  "function getDecryptResultSafe(uint256 ctHash) external view returns (uint256 result, bool decrypted)",
];

// Ethereum Sepolia network configuration for MetaMask
export const ETH_SEPOLIA = {
  chainId: "0xaa36a7", // 11155111
  chainIdNum: 11155111,
  chainName: "Ethereum Sepolia",
  rpcUrls: ["https://ethereum-sepolia.publicnode.com"],
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};

export const ETHERSCAN_TX = (hash: string) =>
  `https://sepolia.etherscan.io/tx/${hash}`;

export const ETHERSCAN_ADDR = (address: string) =>
  `https://sepolia.etherscan.io/address/${address}`;

export function formatUnlockTime(timestamp: number | bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ABI for the true FHE StealthWallet
export const STEALTH_WALLET_ABI = [
  "function payments(uint256) view returns (uint256 id, uint256 encryptedAmount, uint256 unlockTime, address recipient, address sender, bool executed)",
  "function setPayment(tuple(uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature) _encryptedAmount, uint256 _unlockTime, address _recipient) payable",
  "function requestDecryptAmount(uint256 _id)",
  "function executePayment(uint256 _id)",
  "function getPaymentCount() view returns (uint256)",
  "function getPaymentInfo(uint256 _id) view returns (uint256 id, uint256 unlockTime, address recipient, address sender, bool executed)",
  "function getEncryptedAmount(uint256 _id) view returns (uint256)",
  "event PaymentScheduled(uint256 indexed id, address indexed sender, address indexed recipient, uint256 unlockTime)",
  "event PaymentExecuted(uint256 indexed id, address indexed recipient, uint256 amount)"
];

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Unlocked";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(" ");
}

export function formatEth(wei?: bigint | null): string {
  if (wei === undefined || wei === null) return "— ETH";
  const eth = Number(wei) / 1e18;
  return `${eth.toFixed(4)} ETH`;
}

export function formatAmount(eth: string): string {
  const n = parseFloat(eth);
  if (isNaN(n)) return "—";
  return `${n.toFixed(4)} ETH`;
}
