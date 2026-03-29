/**
 * Dashboard.tsx
 * Privacy-first: only shows payments where the connected wallet is sender or recipient.
 * Real-time polling every 5 seconds.
 */

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  CheckCircle2,
  PlusCircle,
  Zap,
  RefreshCw,
  Lock,
  Loader2,
  ExternalLink,
  AlertTriangle,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { Contract } from "ethers";
import { toast } from "sonner";
import WalletGate from "@/components/WalletGate";
import type { WalletInfo } from "@/lib/wallet";
import { shortenAddress } from "@/lib/wallet";
import {
  CONTRACT_ADDRESS,
  CONTRACT_DEPLOYED,
  STEALTH_WALLET_ABI,
  formatUnlockTime,
  formatCountdown,
  formatEth,
  ETHERSCAN_TX,
  ETHERSCAN_ADDR,
} from "@/lib/contract";
import { saveTxHash, loadTxMap } from "@/lib/txStorage";
import { fetchRevealedAmounts } from "@/lib/paymentEvents";
import { getPaymentStatus } from "@/lib/paymentStatus";
import type { PaymentStatus } from "@/lib/paymentStatus";
import {
  historyKey,
  receiptsKey,
  saveHistory,
  loadHistory,
  clearHistoryKeys,
} from "@/lib/historyStorage";

interface DashboardProps {
  wallet: WalletInfo | null;
  onConnect: (w: WalletInfo) => void;
}

export interface ContractPayment {
  id: bigint;
  encryptedAmount: string;
  unlockTime: bigint;
  recipient: string;
  sender: string;
  executed: boolean;
  revealedAmount?: bigint;
}

type Filter = "all" | "sent" | "received" | "pending" | "executed";

// Status badge config keyed by PaymentStatus
const STATUS_BADGE: Record<PaymentStatus, {
  icon: ReactNode;
  label: string;
  className: string;
}> = {
  sending:  { icon: <Loader2  className="w-3 h-3 animate-spin" />, label: "Sending…",   className: "text-blue-400 bg-blue-400/8 border-blue-400/20"     },
  sent:     { icon: <CheckCircle2 className="w-3 h-3" />,          label: "Sent",        className: "text-emerald-400 bg-emerald-400/8 border-emerald-400/20" },
  incoming: { icon: <ArrowDownLeft className="w-3 h-3" />,         label: "Incoming",    className: "text-amber-400 bg-amber-400/8 border-amber-400/20"   },
  received: { icon: <CheckCircle2 className="w-3 h-3" />,          label: "Received",    className: "text-emerald-400 bg-emerald-400/8 border-emerald-400/20" },
  ready:    { icon: <Zap  className="w-3 h-3" />,                  label: "Ready",       className: "text-cyan-400 bg-cyan-400/8 border-cyan-400/20"      },
  pending:  { icon: <Clock className="w-3 h-3" />,                 label: "Pending",     className: "text-gray-400 bg-gray-400/8 border-gray-400/20"      },
  hidden:   { icon: null,                                           label: "",            className: ""                                                    },
};

function LiveCountdown({ unlockTime }: { unlockTime: bigint }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, Number(unlockTime) - Date.now() / 1000);
  if (diff <= 0) return <span className="text-emerald-400 font-medium">Ready to execute</span>;
  return <span className="tabular-nums">{formatCountdown(Math.round(diff))}</span>;
}

function normalizePayments(raw: unknown): ContractPayment[] {
  return Array.from(raw as ArrayLike<unknown>).map((p: unknown) => {
    const r = p as Record<string, unknown>;
    return {
      id: r.id as bigint,
      encryptedAmount: r.encryptedAmount as string,
      unlockTime: r.unlockTime as bigint,
      recipient: r.recipient as string,
      sender: r.sender as string,
      executed: r.executed as boolean,
    };
  });
}

export default function Dashboard({ wallet, onConnect }: DashboardProps) {
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [txMap, setTxMap] = useState<Record<string, string>>(() => loadTxMap());
  const [showBalance, setShowBalance] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const walletAddr = wallet?.address?.toLowerCase() ?? "";

  // Load cached history instantly when wallet connects (before chain query resolves)
  useEffect(() => {
    if (!walletAddr) return;
    const cached = loadHistory(historyKey(walletAddr));
    if (cached.length > 0) setPayments(cached);
  }, [walletAddr]);

  const loadPayments = useCallback(async () => {
    if (!wallet || !CONTRACT_DEPLOYED) return;
    try {
      const contract = new Contract(CONTRACT_ADDRESS, STEALTH_WALLET_ABI, wallet.signer);
      const [count, amountMap] = await Promise.all([
        contract.getPaymentCount(),
        fetchRevealedAmounts(contract),
      ]);
      const all: ContractPayment[] = [];
      for (let i = 0; i < Number(count); i++) {
        const r = await contract.getPaymentInfo(i);
        const id = r.id as bigint;
        all.push({
          id,
          encryptedAmount: "Encrypted",
          unlockTime: r.unlockTime as bigint,
          recipient: r.recipient as string,
          sender: r.sender as string,
          executed: r.executed as boolean,
          revealedAmount: amountMap[String(id)],
        });
      }
      // Privacy: only show payments where this wallet is sender or recipient
      const authorized = all.filter(
        (p) =>
          p.sender?.toLowerCase() === walletAddr ||
          p.recipient?.toLowerCase() === walletAddr
      );
      const result = authorized.reverse();
      setPayments(result);
      // Persist for next session
      saveHistory(historyKey(walletAddr), result);
    } catch (err) {
      console.error("Failed to load payments:", err);
    }
  }, [wallet, walletAddr]);

  const load = useCallback(async () => {
    setLoading(true);
    await loadPayments();
    setLoading(false);
  }, [loadPayments]);

  useEffect(() => {
    load();
    // Real-time polling every 5 seconds
    const interval = setInterval(loadPayments, 5000);
    return () => clearInterval(interval);
  }, [load, loadPayments]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleClearHistory = () => {
    if (!confirm("Are you sure you want to clear your local transaction history? Live data from the blockchain will still be available.")) return;
    clearHistoryKeys(historyKey(walletAddr), receiptsKey(walletAddr));
    setPayments([]);
  };

  const toggleBalance = async () => {
    if (showBalance) {
      setShowBalance(false);
      return;
    }
    // Lazy-fetch on first reveal
    if (!walletBalance && wallet) {
      setBalanceLoading(true);
      try {
        const provider = wallet.signer.provider;
        if (provider) {
          const raw = await provider.getBalance(wallet.address);
          setWalletBalance(formatEth(raw));
        }
      } catch {
        setWalletBalance(null);
      } finally {
        setBalanceLoading(false);
      }
    }
    setShowBalance(true);
  };

  // Execution handles have been moved exclusively to the Execute page

  // Derived sets — all are already authorized (sender or recipient)
  const sentPayments     = payments.filter((p) => p.sender?.toLowerCase() === walletAddr);
  const receivedPayments = payments.filter((p) => p.recipient?.toLowerCase() === walletAddr);
  const pendingPayments  = payments.filter((p) => !p.executed);
  const executedPayments = payments.filter((p) => p.executed);

  const readyCount = pendingPayments.filter(
    (p) =>
      p.sender?.toLowerCase() === walletAddr &&
      Date.now() / 1000 >= Number(p.unlockTime)
  ).length;

  // Incoming pending = payments coming TO me that aren't executed yet
  const incomingPending = receivedPayments.filter((p) => !p.executed);
  const incomingReceived = receivedPayments.filter((p) => p.executed);

  const filtered =
    filter === "sent"     ? sentPayments :
    filter === "received" ? receivedPayments :
    filter === "pending"  ? pendingPayments :
    filter === "executed" ? executedPayments :
    payments; // "all" = all authorized

  const FILTERS: { key: Filter; label: string; count?: number }[] = [
    { key: "all",      label: "All",       count: payments.length },
    { key: "sent",     label: "Sent",      count: sentPayments.length },
    { key: "received", label: "Received",  count: receivedPayments.length },
    { key: "pending",  label: "Pending",   count: pendingPayments.length },
    { key: "executed", label: "Executed",  count: executedPayments.length },
  ];

  return (
    <WalletGate wallet={wallet} onConnect={onConnect}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Your private encrypted payments on Ethereum Sepolia
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg bg-white/4 hover:bg-white/8 text-gray-400 hover:text-white border border-white/8 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing || loading ? "animate-spin" : ""}`} />
            </button>
            <Link href="/create">
              <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors shadow-lg shadow-violet-600/15">
                <PlusCircle className="w-4 h-4" />
                New Confidential Payment
              </button>
            </Link>
          </div>
        </div>

        {/* FHE Privacy Banner */}
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-violet-500/6 border border-violet-500/18">
          <ShieldCheck className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs text-violet-300/90 font-medium">
              Only authorized participants can view transaction details.
            </p>
            <p className="text-xs text-violet-300/60 leading-relaxed">
              All computations are performed on encrypted data using <span className="font-semibold text-violet-300/80">Fully Homomorphic Encryption (FHE)</span>. Sensitive data is never decrypted on-chain.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2 sm:col-span-1 p-4 rounded-xl bg-white/[0.03] border border-white/6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-0.5">Private Balance</p>
              {showBalance ? (
                <p className="text-sm font-semibold text-white">
                  {balanceLoading ? "…" : (walletBalance ?? "—")}
                </p>
              ) : (
                <p className="text-sm font-semibold text-violet-300/80 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Encrypted
                </p>
              )}
              <button
                onClick={toggleBalance}
                className="mt-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors leading-none"
              >
                {showBalance ? "Hide" : "Reveal"}
              </button>
              <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">
                Public on-chain, hidden for privacy
              </p>
            </div>
          </div>
          {[
            { label: "Sent",     value: sentPayments.length,     color: "text-violet-400" },
            { label: "Received", value: receivedPayments.length,  color: "text-cyan-400" },
            { label: "Pending",  value: pendingPayments.length,   color: "text-amber-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-xl bg-white/[0.03] border border-white/6 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Incoming pending banner */}
        {incomingPending.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-cyan-500/8 border border-cyan-500/20">
            <div className="flex items-center gap-2.5">
              <ArrowDownLeft className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-300 font-medium">
                {incomingPending.length} incoming payment{incomingPending.length > 1 ? "s" : ""} scheduled to you
              </span>
            </div>
            <button onClick={() => setFilter("received")} className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
              View →
            </button>
          </div>
        )}

        {/* Ready to execute banner */}
        {readyCount > 0 && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300 font-medium">
                {readyCount} payment{readyCount > 1 ? "s" : ""} ready to execute
              </span>
            </div>
            <Link href="/execute">
              <button className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                Execute →
              </button>
            </Link>
          </div>
        )}

        {/* Privacy notice */}
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/6">
          <AlertTriangle className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            Only payments where you are the <span className="text-gray-400 font-medium">sender or recipient</span> are shown.
            Executed payments appear as{" "}
            <span className="text-gray-400 font-medium">internal transactions</span> on block explorers.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/6 w-fit flex-wrap">
          {FILTERS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === key
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  filter === key ? "bg-white/15 text-white" : "bg-white/6 text-gray-500"
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Payments list */}
        {loading && payments.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-gray-400 font-medium mb-1">
              {filter === "sent"     ? "No payments sent yet" :
               filter === "received" ? "No payments received yet" :
               filter === "pending"  ? "No pending payments" :
               filter === "executed" ? "No executed payments" :
               "No payments yet"}
            </p>
            <p className="text-sm text-gray-600 mb-6 max-w-xs mx-auto">
              {filter === "received"
                ? "Payments sent to your address will appear here."
                : "Schedule your first encrypted payment to get started."}
            </p>
            {filter !== "received" && (
              <Link href="/create">
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors">
                  <PlusCircle className="w-4 h-4" />
                  Schedule Payment
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((payment) => {
              const status = getPaymentStatus(payment, walletAddr, txMap);
              const key = String(payment.id ?? "?");
              const isExecuting = executing === key;
              const isSender    = payment.sender?.toLowerCase() === walletAddr;
              const isRecipient = payment.recipient?.toLowerCase() === walletAddr;
              const badge       = STATUS_BADGE[status];

              const cardClass =
                status === "ready"    ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/30" :
                status === "sending"  ? "bg-blue-500/5 border-blue-500/20 hover:border-blue-500/30" :
                status === "sent"     ? "bg-white/[0.015] border-white/5" :
                status === "received" ? "bg-white/[0.015] border-white/5" :
                status === "incoming" ? "bg-amber-500/4 border-amber-500/15 hover:border-amber-500/25" :
                "bg-white/[0.025] border-white/6 hover:border-white/10";

              return (
                <div
                  key={key}
                  className={`p-5 rounded-xl border transition-colors ${cardClass}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {/* Unified animated status badge + time */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={status}
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            transition={{ duration: 0.18 }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.className}`}
                          >
                            {badge.icon}
                            {badge.label}
                          </motion.span>
                        </AnimatePresence>

                        {/* Direction arrow for self-payments (both sender + recipient) */}
                        {isSender && isRecipient && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-gray-500 bg-gray-500/8 border border-gray-500/15">
                            Self
                          </span>
                        )}

                        {/* Countdown / time label */}
                        <span className="text-xs text-gray-500">
                          {status === "sent" || status === "received"
                            ? `Executed ${formatUnlockTime(payment.unlockTime)}`
                            : status === "sending"
                            ? "Confirming on-chain…"
                            : status === "ready"
                            ? "Unlocked and ready to send"
                            : <LiveCountdown unlockTime={payment.unlockTime} />}
                        </span>
                      </div>

                      {/* Amount + addresses */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          {payment.revealedAmount != null ? (
                            <span className="text-sm text-emerald-400 font-semibold font-mono">
                              {formatEth(payment.revealedAmount)}
                            </span>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-violet-400" />
                              <span className="text-sm text-violet-300/60 italic font-mono">
                                🔒 Encrypted
                              </span>
                            </>
                          )}
                        </div>
                        <span className="text-gray-600">from</span>
                        <a
                          href={ETHERSCAN_ADDR(payment.sender)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-gray-400 font-mono hover:text-gray-200 transition-colors flex items-center gap-1"
                        >
                          {isSender ? "You" : shortenAddress(payment.sender)}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                        <span className="text-gray-600">→</span>
                        <a
                          href={ETHERSCAN_ADDR(payment.recipient)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-gray-400 font-mono hover:text-gray-200 transition-colors flex items-center gap-1"
                        >
                          {isRecipient ? "You" : shortenAddress(payment.recipient)}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>

                      <p className="text-xs text-gray-600 mt-1">
                        Unlock: {formatUnlockTime(payment.unlockTime)}
                      </p>
                    </div>

                    {/* Action area */}
                    <div className="shrink-0 text-right">
                      {status === "ready" && (
                        <Link href="/execute">
                          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 text-emerald-400 text-xs font-semibold transition-colors">
                            <Zap className="w-3 h-3" />
                            Execute in Execute Tab
                          </button>
                        </Link>
                      )}
                      {status === "incoming" && (
                        <span className="text-xs text-amber-400/70 font-medium">
                          Awaiting sender
                        </span>
                      )}
                      {status === "sending" && (
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      )}
                      {(status === "sent" || status === "received") && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      )}
                    </div>
                  </div>

                  {/* Footer row */}
                  <div className="mt-3 pt-3 border-t border-white/4 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-gray-700 font-mono">
                      Payment #{key}
                    </span>
                    <span className="text-[11px] text-violet-600 font-mono">
                      Encrypted · FHE
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* History management */}
        <div className="flex items-center justify-between pt-2 border-t border-white/4">
          <p className="text-[11px] text-gray-700">
            Stored locally for privacy · Not shared
          </p>
          <button
            onClick={handleClearHistory}
            className="text-[11px] text-gray-600 hover:text-red-400 transition-colors"
          >
            Clear local history
          </button>
        </div>
      </div>
    </WalletGate>
  );
}
