/**
 * WalletGate.tsx
 * Renders a prompt when no wallet is connected OR when on the wrong network.
 * Target: Ethereum Sepolia (chainId 11155111).
 */

import { Wallet, RadioTower } from "lucide-react";
import { isMetaMaskInstalled, connectWallet, switchToEthSepolia } from "@/lib/wallet";
import type { WalletInfo } from "@/lib/wallet";
import { useState } from "react";
import { toast } from "sonner";
import { shortenAddress } from "@/lib/wallet";
import { ETH_SEPOLIA } from "@/lib/contract";

interface WalletGateProps {
  wallet: WalletInfo | null;
  onConnect: (w: WalletInfo) => void;
  children: React.ReactNode;
}

export default function WalletGate({ wallet, onConnect, children }: WalletGateProps) {
  const [connecting, setConnecting] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Correct network — show the page
  if (wallet && wallet.chainId === ETH_SEPOLIA.chainIdNum) return <>{children}</>;

  const handleConnect = async () => {
    if (!isMetaMaskInstalled()) {
      toast.error("MetaMask required", {
        description: "Install MetaMask from metamask.io to use StealthFlow.",
      });
      return;
    }
    setConnecting(true);
    try {
      const info = await connectWallet();
      onConnect(info);
      toast.success("Wallet connected", { description: shortenAddress(info.address) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect";
      toast.error("Connection failed", { description: msg });
    } finally {
      setConnecting(false);
    }
  };

  const handleSwitchNetwork = async () => {
    setSwitching(true);
    try {
      await switchToEthSepolia();
      const info = await connectWallet();
      onConnect(info);
      toast.success("Switched to Ethereum Sepolia", {
        description: "You're now on the testnet. Grab ETH from the faucet if needed.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network switch failed";
      toast.error("Network switch failed", { description: msg });
    } finally {
      setSwitching(false);
    }
  };

  // Connected but wrong network
  if (wallet && wallet.chainId !== ETH_SEPOLIA.chainIdNum) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
          <RadioTower className="w-7 h-7 text-amber-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Wrong network</h2>
        <p className="text-sm text-gray-500 max-w-xs mb-2">
          StealthFlow runs on <strong className="text-white">Ethereum Sepolia</strong> testnet.
          Switch networks to continue.
        </p>
        <p className="text-xs text-gray-600 mb-6">Current chain ID: {wallet.chainId}</p>
        <button
          onClick={handleSwitchNetwork}
          disabled={switching}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-medium transition-colors shadow-lg shadow-violet-600/20"
        >
          <RadioTower className="w-4 h-4" />
          {switching ? "Switching…" : "Switch to Ethereum Sepolia"}
        </button>
        <p className="mt-4 text-xs text-gray-600 max-w-xs">
          MetaMask will add Ethereum Sepolia automatically if it's not already in your network list.
        </p>
      </div>
    );
  }

  // Not connected
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mb-5">
        <Wallet className="w-7 h-7 text-gray-500" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Connect your wallet</h2>
      <p className="text-sm text-gray-500 max-w-xs mb-6">
        Connect MetaMask to schedule and manage your encrypted payments on Ethereum Sepolia.
      </p>
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-medium transition-colors shadow-lg shadow-violet-600/20"
      >
        <Wallet className="w-4 h-4" />
        {connecting ? "Connecting…" : "Connect MetaMask"}
      </button>
      {!isMetaMaskInstalled() && (
        <p className="mt-4 text-xs text-gray-600">
          MetaMask not detected.{" "}
          <a
            href="https://metamask.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:underline"
          >
            Install it here
          </a>
        </p>
      )}
    </div>
  );
}
