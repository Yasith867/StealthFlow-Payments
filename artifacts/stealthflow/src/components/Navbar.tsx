/**
 * Navbar.tsx
 * Global navigation bar for StealthFlow.
 */

import { Link, useLocation } from "wouter";
import {
  Shield,
  LayoutDashboard,
  PlusCircle,
  Zap,
  Wallet,
  ChevronDown,
  AlertTriangle,
  LogOut,
  Copy,
  Check,
  Receipt,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shortenAddress, isMetaMaskInstalled, connectWallet, switchToEthSepolia } from "@/lib/wallet";
import type { WalletInfo } from "@/lib/wallet";
import { ETH_SEPOLIA } from "@/lib/contract";
import { toast } from "sonner";

interface NavbarProps {
  wallet: WalletInfo | null;
  onConnect: (wallet: WalletInfo) => void;
  onDisconnect: () => void;
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Create", icon: PlusCircle },
  { href: "/execute", label: "Execute", icon: Zap },
  { href: "/receipts", label: "Receipts", icon: Receipt },
];

export default function Navbar({ wallet, onConnect, onDisconnect }: NavbarProps) {
  const [location] = useLocation();
  const [connecting, setConnecting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setWalletOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleConnect = async () => {
    if (!isMetaMaskInstalled()) {
      toast.error("MetaMask not found", {
        description: "Install MetaMask from metamask.io to continue.",
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
      toast.success("Switched to Ethereum Sepolia");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network switch failed";
      toast.error("Network switch failed", { description: msg });
    } finally {
      setSwitching(false);
    }
  };

  const handleCopy = () => {
    if (!wallet?.address) return;
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDisconnect = () => {
    setWalletOpen(false);
    onDisconnect();
    toast.success("Wallet disconnected");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/6 bg-[#070710]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-white tracking-tight">StealthFlow</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/8 text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/4"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Network badge */}
          {wallet && (
            wallet.chainId === ETH_SEPOLIA.chainIdNum ? (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-xs font-medium text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/60" />
                Ethereum Sepolia
              </div>
            ) : (
              <button
                onClick={handleSwitchNetwork}
                disabled={switching}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-medium text-red-400 transition-colors disabled:opacity-60"
              >
                {switching ? (
                  <span className="animate-pulse">Switching...</span>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    Wrong Network (Switch)
                  </>
                )}
              </button>
            )
          )}

          {/* Wallet pill / dropdown */}
          {wallet ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setWalletOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/15 text-sm transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                <span className="text-gray-300 font-mono text-xs">{shortenAddress(wallet.address)}</span>
                <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${walletOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown */}
              {walletOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-[#0e0e1a] border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
                  {/* Address block */}
                  <div className="px-4 py-3 border-b border-white/6">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Connected wallet</p>
                    <p className="text-xs text-gray-300 font-mono break-all">{wallet.address}</p>
                  </div>

                  {/* Actions */}
                  <div className="p-1.5 space-y-0.5">
                    <button
                      onClick={handleCopy}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-left"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy address
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleDisconnect}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/8 transition-colors text-left"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-medium transition-colors shadow-lg shadow-violet-600/20"
            >
              <Wallet className="w-3.5 h-3.5" />
              {connecting ? "Connecting…" : "Connect"}
            </button>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-white/6 bg-[#070710]/95 px-4 py-3 space-y-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/8 text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/4"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
          {wallet && (
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/8 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Disconnect wallet
            </button>
          )}
        </div>
      )}
    </header>
  );
}
