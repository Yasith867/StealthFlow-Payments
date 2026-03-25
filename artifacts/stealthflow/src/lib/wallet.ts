/**
 * wallet.ts
 * MetaMask wallet connection helpers using ethers.js v6.
 * Target network: Ethereum Sepolia (chainId 11155111).
 */

import { BrowserProvider, Contract, type JsonRpcSigner } from "ethers";
import { STEALTH_WALLET_ABI, ETH_SEPOLIA } from "./contract";

export interface WalletInfo {
  address: string;
  provider: BrowserProvider;
  signer: JsonRpcSigner;
  chainId: number;
}

type EthereumRequest = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getEthereum(): EthereumRequest {
  return (window as unknown as Window & { ethereum: EthereumRequest }).ethereum;
}

export function isMetaMaskInstalled(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as Window & { ethereum?: unknown }).ethereum !== "undefined"
  );
}

export async function connectWallet(): Promise<WalletInfo> {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed. Please install it from metamask.io");
  }
  const provider = new BrowserProvider(
    getEthereum() as import("ethers").Eip1193Provider
  );
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  return { address, provider, signer, chainId };
}

export function getContract(address: string, signer: JsonRpcSigner) {
  return new Contract(address, STEALTH_WALLET_ABI, signer);
}

/**
 * Ask MetaMask to switch to (or add) Ethereum Sepolia.
 * Called automatically when the user is on the wrong network.
 */
export async function switchToEthSepolia(): Promise<void> {
  const ethereum = getEthereum();
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ETH_SEPOLIA.chainId }],
    });
  } catch (err: unknown) {
    // 4902 = chain not added yet — add it
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [ETH_SEPOLIA],
      });
    } else {
      throw err;
    }
  }
}

export function shortenAddress(address?: string): string {
  if (!address || typeof address !== "string" || address.length < 10) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
