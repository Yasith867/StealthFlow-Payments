/**
 * Execute.tsx
 * Shows all unlocked payments from the contract and lets users execute them.
 *
 * Two-phase flow (no inline oracle waiting):
 *   Phase 1 – "Request Decrypt": sends requestDecryptAmount tx, marks payment as
 *              oracle-pending in localStorage, then immediately returns.
 *   Phase 2 – "Complete Transfer": only shown once a background poll detects the
 *              oracle has responded (executePayment.staticCall succeeds). Calls
 *              executePayment directly with no timeout risk.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import {
  Zap,
  Clock,
  Lock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
  AlertTriangle,
  Hourglass,
} from "lucide-react";
import { toast } from "sonner";
import { Contract } from "ethers";
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
import {
  saveTxHash,
  loadTxMap,
  markDecryptPending,
  clearDecryptPending,
  loadDecryptPending,
} from "@/lib/txStorage";
import { fetchRevealedAmounts } from "@/lib/paymentEvents";
import type { ContractPayment } from "./Dashboard";
import { getPaymentStatus } from "@/lib/paymentStatus";

interface ExecuteProps {
  wallet: WalletInfo | null;
  onConnect: (w: WalletInfo) => void;
}

function LiveCountdown({ unlockTime }: { unlockTime: bigint }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, Number(unlockTime) - Date.now() / 1000);
  if (diff <= 0) return <span className="text-emerald-400">Unlocked</span>;
  return <span className="tabular-nums">{formatCountdown(Math.round(diff))}</span>;
}

export default function Execute({ wallet, onConnect }: ExecuteProps) {
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [txMap, setTxMap] = useState<Record<string, string>>(() => loadTxMap());

  // Payments where we've sent requestDecryptAmount but oracle hasn't responded yet
  const [decryptPending, setDecryptPending] = useState<Record<string, boolean>>(
    () => loadDecryptPending()
  );
  // Payments where the oracle has responded and executePayment is ready
  const [oracleReady, setOracleReady] = useState<Set<string>>(new Set());

  const walletAddr = wallet?.address?.toLowerCase() ?? "";
  const contractRef = useRef<Contract | null>(null);

  useEffect(() => {
    if (wallet) {
      contractRef.current = new Contract(CONTRACT_ADDRESS, STEALTH_WALLET_ABI, wallet.signer);
    }
  }, [wallet]);

  const loadPayments = useCallback(async () => {
    if (!wallet || !CONTRACT_DEPLOYED) return;
    try {
      const contract = contractRef.current!;
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
      const authorized = all.filter(
        (p) =>
          p.sender?.toLowerCase() === walletAddr ||
          p.recipient?.toLowerCase() === walletAddr
      );
      setPayments(authorized);
    } catch (err) {
      console.error("Failed to load payments:", err);
    }
  }, [wallet, walletAddr]);

  /** Poll oracle-pending payments to see if executePayment is ready */
  const pollOracleReady = useCallback(async () => {
    const contract = contractRef.current;
    if (!contract) return;
    const pending = loadDecryptPending();
    const ids = Object.keys(pending);
    if (ids.length === 0) return;

    const nowReady: string[] = [];
    for (const id of ids) {
      try {
        await contract.executePayment.staticCall(BigInt(id));
        nowReady.push(id);
      } catch {
        // Oracle hasn't responded yet for this one — keep waiting
      }
    }

    if (nowReady.length > 0) {
      for (const id of nowReady) {
        clearDecryptPending(id);
      }
      setDecryptPending(loadDecryptPending());
      setOracleReady((prev) => {
        const next = new Set(prev);
        for (const id of nowReady) next.add(id);
        return next;
      });
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await loadPayments();
    setLoading(false);
  }, [loadPayments]);

  useEffect(() => {
    load();
    // Refresh payment list every 10s
    const paymentInterval = setInterval(loadPayments, 10000);
    // Poll oracle status every 5s (lightweight staticCall)
    const oracleInterval = setInterval(pollOracleReady, 5000);
    return () => {
      clearInterval(paymentInterval);
      clearInterval(oracleInterval);
    };
  }, [load, loadPayments, pollOracleReady]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    await pollOracleReady();
    setRefreshing(false);
  };

  /**
   * Phase 1: send requestDecryptAmount and persist pending state.
   * Returns immediately — the oracle poll will detect when it's done.
   */
  const handleRequestDecrypt = async (payment: ContractPayment) => {
    if (!wallet || !contractRef.current) return;
    const key = String(payment.id ?? "?");
    setExecuting(key);
    try {
      const contract = contractRef.current;
      const tx = await contract.requestDecryptAmount(payment.id) as { hash: string; wait: () => Promise<unknown> };
      saveTxHash(key + "_decrypt", tx.hash);
      await tx.wait();

      markDecryptPending(key);
      setDecryptPending(loadDecryptPending());

      toast.info("Decryption requested. The oracle is processing — check back shortly to complete the transfer.", {
        duration: 8000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      toast.error("Decrypt request failed", { description: msg });
    } finally {
      setExecuting(null);
    }
  };

  /**
   * Phase 2: oracle has confirmed — call executePayment directly, no polling needed.
   */
  const handleCompleteTransfer = async (payment: ContractPayment) => {
    if (!wallet || !contractRef.current) return;
    const key = String(payment.id ?? "?");
    setExecuting(key);
    try {
      const contract = contractRef.current;
      const tx = await contract.executePayment(payment.id) as { hash: string; wait: () => Promise<unknown> };

      saveTxHash(key, tx.hash);
      setTxMap((prev) => ({ ...prev, [key]: tx.hash }));
      setOracleReady((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setExecuting(null);

      toast.success("Transaction submitted!", {
        description: (
          <span>
            Payment executed for {shortenAddress(payment.recipient)}.{" "}
            <a href={ETHERSCAN_TX(tx.hash)} target="_blank" rel="noopener noreferrer" className="underline font-medium">
              View on Etherscan ↗
            </a>
            <br />
            <span className="text-gray-400 text-xs">Sent via smart contract</span>
          </span>
        ) as unknown as string,
        duration: 12000,
      });

      tx.wait().then(() => loadPayments()).catch(console.error);
    } catch (err: unknown) {
      setExecuting(null);
      const msg = err instanceof Error ? err.message : "Execution failed";
      toast.error("Execution failed", { description: msg });
    }
  };

  const now = Date.now() / 1000;
  const pending = payments.filter((p) => !p.executed);
  const ready = pending.filter((p) => Number(p.unlockTime) <= now);
  const locked = pending.filter((p) => Number(p.unlockTime) > now);
  const recentExecuted = payments.filter((p) => p.executed).slice(-5).reverse();

  return (
    <WalletGate wallet={wallet} onConnect={onConnect}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Execute Confidential Transfers</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Release encrypted funds once conditions are met, verified on-chain without revealing sensitive data.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-white/4 hover:bg-white/8 text-gray-400 hover:text-white border border-white/8 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing || loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Internal tx notice */}
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/6">
          <AlertTriangle className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            Executed payments appear as{" "}
            <span className="text-gray-400 font-medium">internal transactions</span> on block
            explorers. The ETH is transferred by the smart contract, not directly from your wallet.
            This is expected behaviour.
          </p>
        </div>

        {/* Loading */}
        {loading && payments.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
          </div>
        )}

        {/* Ready to execute */}
        {!loading && (
          <section>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              Ready to Execute ({ready.length})
            </h2>

            {ready.length === 0 ? (
              <div className="p-8 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                <Zap className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No payments are ready to execute yet.</p>
                <p className="text-gray-600 text-xs mt-1">
                  Payments appear here once their unlock time has passed.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {ready.map((payment) => {
                  const key = String(payment.id ?? "?");
                  const isExecuting   = executing === key;
                  const isSender      = payment.sender?.toLowerCase() === walletAddr;
                  const isRecipient   = payment.recipient?.toLowerCase() === walletAddr;
                  const status        = getPaymentStatus(payment, walletAddr, txMap);
                  const isSending     = status === "sending";
                  const isPendingOracle = decryptPending[key];
                  const isOracleReady = oracleReady.has(key);

                  return (
                    <div
                      key={key}
                      className={`p-5 rounded-xl border transition-colors ${
                        isSending
                          ? "bg-blue-500/5 border-blue-500/20"
                          : isPendingOracle
                          ? "bg-amber-500/5 border-amber-500/15"
                          : isOracleReady
                          ? "bg-violet-500/5 border-violet-500/15 hover:border-violet-500/25"
                          : "bg-emerald-500/5 border-emerald-500/15 hover:border-emerald-500/25"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {isSending ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-blue-400 bg-blue-400/8 border border-blue-400/20">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Sending…
                              </span>
                            ) : isPendingOracle ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-amber-400 bg-amber-400/8 border border-amber-400/15">
                                <Hourglass className="w-3 h-3" />
                                Awaiting Oracle
                              </span>
                            ) : isOracleReady ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-violet-400 bg-violet-400/8 border border-violet-400/15">
                                <CheckCircle2 className="w-3 h-3" />
                                Oracle Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-cyan-400 bg-cyan-400/8 border border-cyan-400/15">
                                <Zap className="w-3 h-3" />
                                Ready
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {isSending
                                ? "Confirming on-chain…"
                                : isPendingOracle
                                ? "Decryption in progress — page will update automatically"
                                : `Payment #${key}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Lock className="w-3 h-3 text-violet-400" />
                              <span className="text-sm text-violet-300/60 italic font-mono">
                                🔒 Encrypted
                              </span>
                            </div>
                            <span className="text-gray-600">→</span>
                            <a
                              href={ETHERSCAN_ADDR(payment.recipient)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-gray-400 font-mono hover:text-gray-200 flex items-center gap-1 transition-colors"
                            >
                              {isRecipient ? "You" : shortenAddress(payment.recipient)}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>

                        {/* Action buttons */}
                        {isSending && (
                          <Loader2 className="shrink-0 w-5 h-5 text-blue-400 animate-spin" />
                        )}

                        {!isSending && isSender && isPendingOracle && (
                          <div className="shrink-0 flex items-center gap-1.5 text-amber-400/70">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-xs font-medium">Waiting…</span>
                          </div>
                        )}

                        {!isSending && isSender && isOracleReady && (
                          <button
                            onClick={() => handleCompleteTransfer(payment)}
                            disabled={executing !== null}
                            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-600/15"
                          >
                            {isExecuting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Sending…
                              </>
                            ) : (
                              <>
                                <Zap className="w-3.5 h-3.5" />
                                Complete Transfer
                              </>
                            )}
                          </button>
                        )}

                        {!isSending && isSender && !isPendingOracle && !isOracleReady && (
                          <button
                            onClick={() => handleRequestDecrypt(payment)}
                            disabled={executing !== null}
                            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-600/15"
                          >
                            {isExecuting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Requesting…
                              </>
                            ) : (
                              <>
                                <Zap className="w-3.5 h-3.5" />
                                Execute Transfer
                              </>
                            )}
                          </button>
                        )}

                        {!isSending && isRecipient && !isSender && (
                          <span className="shrink-0 text-xs text-amber-400/70 font-medium">
                            Awaiting sender
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Locked */}
        {locked.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              Locked ({locked.length})
            </h2>
            <div className="space-y-3">
              {locked.map((payment) => {
                const key = String(payment.id ?? "?");
                const isSender    = payment.sender?.toLowerCase() === walletAddr;
                const isRecipient = payment.recipient?.toLowerCase() === walletAddr;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 p-5 rounded-xl bg-white/[0.025] border border-white/6 opacity-70"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {isRecipient && !isSender ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-amber-400 bg-amber-400/8 border border-amber-400/15">
                            <Clock className="w-3 h-3" />
                            Incoming
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-amber-400 bg-amber-400/8 border border-amber-400/15">
                            <Clock className="w-3 h-3" />
                            Locked
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          #{key} · <LiveCountdown unlockTime={payment.unlockTime} /> remaining
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm text-violet-300/60 italic font-mono">
                          🔒 Encrypted
                        </span>
                        <span className="text-gray-600">→</span>
                        <span className="text-sm text-gray-400 font-mono">
                          {isRecipient ? "You" : shortenAddress(payment.recipient)}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-gray-600">Unlocks</p>
                      <p className="text-xs text-gray-400">{formatUnlockTime(payment.unlockTime)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Recently executed */}
        {recentExecuted.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              Recently Executed
            </h2>
            <div className="space-y-2">
              {recentExecuted.map((payment) => {
                const isSender    = payment.sender?.toLowerCase() === walletAddr;
                const isRecipient = payment.recipient?.toLowerCase() === walletAddr;
                return (
                  <div
                    key={String(payment.id ?? "?")}
                    className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-white/[0.02] border border-white/5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {payment.revealedAmount != null ? (
                            <span className="text-sm text-emerald-400 font-semibold font-mono">
                              {formatEth(payment.revealedAmount)}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-300 font-mono font-medium flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-violet-400" />
                              Encrypted
                            </span>
                          )}
                          <span className="text-gray-600">→</span>
                          <a
                            href={ETHERSCAN_ADDR(payment.recipient)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-gray-500 font-mono hover:text-gray-300 flex items-center gap-1 transition-colors"
                          >
                            {isRecipient ? "You" : shortenAddress(payment.recipient)}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Payment #{String(payment.id ?? "?")} · Unlocked {payment.unlockTime ? formatUnlockTime(payment.unlockTime) : "—"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-400 font-medium shrink-0">
                      {isRecipient && !isSender ? "Received" : "Sent"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!loading && payments.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-500 text-sm mb-4">No payments scheduled yet.</p>
            <Link href="/create">
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Schedule a Payment
              </button>
            </Link>
          </div>
        )}
      </div>
    </WalletGate>
  );
}
