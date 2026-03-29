/**
 * Receipts.tsx
 * Shows executed payment receipts — both received and sent — for the
 * connected wallet. Tabs switch between the two views.
 */

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Loader2,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { Contract, formatEther } from "ethers";
import WalletGate from "@/components/WalletGate";
import type { WalletInfo } from "@/lib/wallet";
import { shortenAddress } from "@/lib/wallet";
import {
  CONTRACT_ADDRESS,
  CONTRACT_DEPLOYED,
  STEALTH_WALLET_ABI,
  formatUnlockTime,
  formatEth,
  ETHERSCAN_TX,
  ETHERSCAN_ADDR,
} from "@/lib/contract";
import type { ContractPayment } from "./Dashboard";
import { loadTxMap } from "@/lib/txStorage";
import { receiptsKey, saveHistory, loadHistory } from "@/lib/historyStorage";
import { fetchRevealedAmounts } from "@/lib/paymentEvents";

interface ReceiptsProps {
  wallet: WalletInfo | null;
  onConnect: (w: WalletInfo) => void;
}

type Tab = "received" | "sent";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-gray-600 hover:text-gray-300 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function Receipts({ wallet, onConnect }: ReceiptsProps) {
  const [allPayments, setAllPayments] = useState<ContractPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [txMap, setTxMap] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<Tab>("received");

  const walletAddr = wallet?.address?.toLowerCase() ?? "";

  // Load cached receipts instantly when wallet connects
  useEffect(() => {
    if (!walletAddr) return;
    const cached = loadHistory(receiptsKey(walletAddr));
    if (cached.length > 0) setAllPayments(cached);
  }, [walletAddr]);

  const loadPayments = useCallback(async () => {
    if (!wallet || !CONTRACT_DEPLOYED) return;
    try {
      const contract = new Contract(CONTRACT_ADDRESS, STEALTH_WALLET_ABI, wallet.signer);
      const [count, amountMap] = await Promise.all([
        contract.getPaymentCount(),
        fetchRevealedAmounts(contract),
      ]);
      const mapped: ContractPayment[] = [];
      for (let i = 0; i < Number(count); i++) {
        const r = await contract.getPaymentInfo(i);
        const id = r.id as bigint;
        mapped.push({
          id,
          encryptedAmount: "Encrypted",
          unlockTime: r.unlockTime as bigint,
          recipient: r.recipient as string,
          sender: r.sender as string,
          executed: r.executed as boolean,
          revealedAmount: amountMap[String(id)],
        });
      }
      // All executed payments where this wallet is sender OR recipient
      const authorized = mapped
        .filter(
          (p) =>
            p.executed === true &&
            (p.recipient?.toLowerCase() === walletAddr ||
              p.sender?.toLowerCase() === walletAddr)
        )
        .reverse();
      setAllPayments(authorized);
      // Persist for next session
      saveHistory(receiptsKey(walletAddr), authorized);
    } catch (err) {
      console.error("Failed to load payments:", err);
    }
  }, [wallet, walletAddr]);

  const load = useCallback(async () => {
    setLoading(true);
    setTxMap(loadTxMap());
    await loadPayments();
    setLoading(false);
  }, [loadPayments]);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      loadPayments();
      setTxMap(loadTxMap());
    }, 5000);
    return () => clearInterval(interval);
  }, [load, loadPayments]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setTxMap(loadTxMap());
    await loadPayments();
    setRefreshing(false);
  };

  // Split into received and sent (a payment where you are both sender and
  // recipient counts in both — edge case but handled gracefully)
  const receivedPayments = allPayments.filter(
    (p) => p.recipient?.toLowerCase() === walletAddr
  );
  const sentPayments = allPayments.filter(
    (p) => p.sender?.toLowerCase() === walletAddr
  );

  const payments = activeTab === "received" ? receivedPayments : sentPayments;

  const totalReceived = receivedPayments.length;
  const totalSent = sentPayments.length;

  return (
    <WalletGate wallet={wallet} onConnect={onConnect}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Payment Receipts</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Confidential transfers verified on-chain without revealing sensitive data
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-white/4 hover:bg-white/8 text-gray-400 hover:text-white border border-white/8 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing || loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* FHE Privacy Banner */}
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-violet-500/6 border border-violet-500/18">
          <ShieldCheck className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
          <p className="text-xs text-violet-300/80 leading-relaxed">
            All payment data is encrypted using{" "}
            <span className="font-semibold text-violet-300">Fully Homomorphic Encryption (FHE)</span>.
            Only authorized parties can view transaction details.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/6">
            <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Received</p>
            <p className="text-2xl font-bold text-emerald-400">{receivedPayments.length}</p>
            <p className="text-xs text-gray-600 mt-0.5 font-mono">Private</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/6">
            <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Sent</p>
            <p className="text-2xl font-bold text-violet-400">{sentPayments.length}</p>
            <p className="text-xs text-gray-600 mt-0.5 font-mono">Private</p>
          </div>
          <div className="col-span-2 p-4 rounded-xl bg-white/[0.03] border border-white/6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Private Balance</p>
              <p className="text-sm font-semibold text-violet-300/80 flex items-center gap-1 mt-0.5">
                <Lock className="w-3 h-3" /> Encrypted
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/6 w-fit">
          {(["received", "sent"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? tab === "received"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                    : "bg-violet-500/15 text-violet-300 border border-violet-500/20"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab === "received" ? (
                <ArrowDownLeft className="w-3.5 h-3.5" />
              ) : (
                <ArrowUpRight className="w-3.5 h-3.5" />
              )}
              {tab === "received" ? "Received" : "Sent"}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab
                  ? tab === "received" ? "bg-emerald-500/20 text-emerald-400" : "bg-violet-500/20 text-violet-400"
                  : "bg-white/6 text-gray-600"
              }`}>
                {tab === "received" ? receivedPayments.length : sentPayments.length}
              </span>
            </button>
          ))}
        </div>

        {/* Receipt list */}
        {loading && payments.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/6 flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-7 h-7 text-gray-600" />
            </div>
            <p className="text-gray-400 font-medium mb-1">
              {activeTab === "received" ? "No receipts yet" : "No sent payments yet"}
            </p>
            <p className="text-sm text-gray-600 max-w-xs mx-auto">
              {activeTab === "received"
                ? "When someone completes a confidential transfer to you, it will appear here with on-chain verification proof."
                : "When you execute a confidential transfer, it will appear here with on-chain verification proof."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => {
              const id = String(payment.id ?? "?");
              const txHash = txMap[id];
              const isSent = activeTab === "sent";

              return (
                <div
                  key={id}
                  className="rounded-xl bg-white/[0.025] border border-white/8 overflow-hidden"
                >
                  {/* Top bar */}
                  <div className={`flex items-center justify-between px-5 py-3 border-b ${
                    isSent
                      ? "bg-violet-500/5 border-violet-500/10"
                      : "bg-emerald-500/5 border-emerald-500/10"
                  }`}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`w-4 h-4 ${isSent ? "text-violet-400" : "text-emerald-400"}`} />
                      <span className={`text-sm font-semibold ${isSent ? "text-violet-300" : "text-emerald-300"}`}>
                        {isSent ? "Sent" : "Received"}
                      </span>
                    </div>
                    <span className="text-xs text-gray-600 font-mono">Receipt #{id}</span>
                  </div>

                  {/* Body */}
                  <div className="px-5 py-4 space-y-4">

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Amount</span>
                      <span className="text-lg font-bold text-white font-mono flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-violet-400" />
                        Encrypted
                      </span>
                    </div>

                    <div className="h-px bg-white/4" />

                    {/* From */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-gray-500 uppercase tracking-wide shrink-0">From</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <a
                          href={ETHERSCAN_ADDR(payment.sender)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-gray-300 font-mono hover:text-white flex items-center gap-1 transition-colors"
                        >
                          {isSent ? "You" : shortenAddress(payment.sender)}
                          {!isSent && <ExternalLink className="w-3 h-3" />}
                        </a>
                        {!isSent && <CopyButton text={payment.sender ?? ""} />}
                      </div>
                    </div>

                    {/* To */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-gray-500 uppercase tracking-wide shrink-0">To</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <a
                          href={ETHERSCAN_ADDR(payment.recipient)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-gray-300 font-mono hover:text-white flex items-center gap-1 transition-colors"
                        >
                          {!isSent ? "You" : shortenAddress(payment.recipient)}
                          {isSent && <ExternalLink className="w-3 h-3" />}
                        </a>
                        {isSent && <CopyButton text={payment.recipient ?? ""} />}
                      </div>
                    </div>

                    {/* Unlock date */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-gray-500 uppercase tracking-wide shrink-0">Unlocked</span>
                      <span className="text-sm text-gray-400">
                        {payment.unlockTime ? formatUnlockTime(payment.unlockTime) : "—"}
                      </span>
                    </div>

                    {/* TX Hash */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-gray-500 uppercase tracking-wide shrink-0">Verified Tx</span>
                      {txHash ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <a
                            href={ETHERSCAN_TX(txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-violet-400 font-mono hover:text-violet-300 flex items-center gap-1 transition-colors"
                          >
                            {shortenAddress(txHash)}
                            <ArrowUpRight className="w-3 h-3" />
                          </a>
                          <CopyButton text={txHash} />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600 italic">
                          {isSent ? "Tx hash not captured" : "Execute via this app to capture tx hash"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  {txHash && (
                    <div className="px-5 py-3 bg-white/[0.015] border-t border-white/5">
                      <a
                        href={ETHERSCAN_TX(txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Verify on Ethereum Sepolia Explorer
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WalletGate>
  );
}
