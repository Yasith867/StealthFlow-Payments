/**
 * Execute.tsx
 * Shows all unlocked payments from the contract and lets the sender execute them.
 *
 * New single-phase flow (replaces old oracle-based two-phase flow):
 *   1. SDK calls Threshold Network directly to decrypt the amount (decryptForTx)
 *   2. Publish the decryption result on-chain to the CoFHE TaskManager
 *   3. Call executePayment — the contract reads the published result via getDecryptResultSafe
 *
 * Migrated to @cofhe/sdk (v0.4.0) — old fhenixjs/cofhejs decrypt flow deprecated.
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
  TASK_MANAGER_ADDRESS,
  TASK_MANAGER_ABI,
  ETH_SEPOLIA,
  formatUnlockTime,
  formatCountdown,
  ETHERSCAN_TX,
  ETHERSCAN_ADDR,
} from "@/lib/contract";
import { saveTxHash, loadTxMap } from "@/lib/txStorage";
import type { ContractPayment } from "./Dashboard";
import { getPaymentStatus } from "@/lib/paymentStatus";
import { createCofheConfig, createCofheClient } from "@cofhe/sdk/web";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";

interface ExecuteProps {
  wallet: WalletInfo | null;
  onConnect: (w: WalletInfo) => void;
}

type ExecPhase = "decrypting" | "publishing" | "executing";

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

const PHASE_LABELS: Record<ExecPhase, string> = {
  decrypting: "Decrypting via Threshold Network…",
  publishing: "Publishing decrypt result on-chain…",
  executing: "Sending payment…",
};

export default function Execute({ wallet, onConnect }: ExecuteProps) {
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [execPhase, setExecPhase] = useState<ExecPhase | null>(null);
  const [txMap, setTxMap] = useState<Record<string, string>>(() => loadTxMap());

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
      const count = await contract.getPaymentCount();
      const all: ContractPayment[] = [];
      for (let i = 0; i < Number(count); i++) {
        const r = await contract.getPaymentInfo(i);
        all.push({
          id: r.id as bigint,
          encryptedAmount: "Encrypted",
          unlockTime: r.unlockTime as bigint,
          recipient: r.recipient as string,
          sender: r.sender as string,
          executed: r.executed as boolean,
        });
      }
      const authorized = all.filter(
        (p) =>
          p.sender?.toLowerCase() === walletAddr ||
          p.recipient?.toLowerCase() === walletAddr,
      );
      setPayments(authorized);
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
    const interval = setInterval(loadPayments, 10000);
    return () => clearInterval(interval);
  }, [load, loadPayments]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /**
   * New single-step execute flow using @cofhe/sdk:
   *   1. decryptForTx  → Threshold Network returns decryptedValue + signature
   *   2. publishDecryptResult → writes result to CoFHE TaskManager on-chain
   *   3. executePayment → contract reads result via FHE.getDecryptResultSafe
   */
  const handleExecute = async (payment: ContractPayment) => {
    if (!wallet || !contractRef.current) return;
    const key = String(payment.id ?? "?");
    setExecuting(key);

    try {
      const contract = contractRef.current;

      // --- Step 1: Fetch ctHash and set up SDK client ---
      setExecPhase("decrypting");

      const { publicClient, walletClient } = await Ethers6Adapter(
        wallet.signer.provider!,
        wallet.signer,
      );
      const cofheConfig = createCofheConfig({
        network: {
          chainId: ETH_SEPOLIA.chainIdNum,
          rpcUrl: ETH_SEPOLIA.rpcUrls[0],
        },
      });
      const cofheClient = createCofheClient(cofheConfig);
      await cofheClient.connect({ publicClient, walletClient });

      const ctHash = (await contract.getEncryptedAmount(payment.id)) as bigint;

      // Decrypt via Threshold Network (new flow — no oracle required)
      const decryptResult = await cofheClient
        .decryptForTx(ctHash)
        .setAccount(wallet.address)
        .setChainId(ETH_SEPOLIA.chainIdNum)
        .withoutPermit()
        .execute();

      // --- Step 2: Publish decrypt result to TaskManager ---
      setExecPhase("publishing");

      const taskManager = new Contract(TASK_MANAGER_ADDRESS, TASK_MANAGER_ABI, wallet.signer);
      const publishTx = (await taskManager.publishDecryptResult(
        BigInt(decryptResult.ctHash as bigint),
        decryptResult.decryptedValue,
        decryptResult.signature,
      )) as { hash: string; wait: () => Promise<unknown> };
      await publishTx.wait();

      // --- Step 3: Execute the payment ---
      setExecPhase("executing");

      const execTx = (await contract.executePayment(payment.id)) as {
        hash: string;
        wait: () => Promise<unknown>;
      };

      saveTxHash(key, execTx.hash);
      setTxMap((prev) => ({ ...prev, [key]: execTx.hash }));

      setExecuting(null);
      setExecPhase(null);

      toast.success("Payment executed!", {
        description: (
          <span>
            Sent to {shortenAddress(payment.recipient)}.{" "}
            <a
              href={ETHERSCAN_TX(execTx.hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              View on Etherscan ↗
            </a>
          </span>
        ) as unknown as string,
        duration: 12000,
      });

      execTx.wait().then(() => loadPayments()).catch(console.error);
    } catch (err: unknown) {
      setExecuting(null);
      setExecPhase(null);
      const msg = err instanceof Error ? err.message : "Execution failed";
      const lower = msg.toLowerCase();
      const friendly =
        lower.includes("user rejected") || lower.includes("action_rejected")
          ? "Transaction was rejected in your wallet."
          : lower.includes("decryption not ready")
          ? "Decryption not ready yet. Please wait a moment and try again."
          : msg.length > 120
          ? "Execution failed. Please try again."
          : msg;
      toast.error("Execution failed", { description: friendly });
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
              Release encrypted funds once conditions are met, verified on-chain without revealing
              sensitive data.
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
                  const isExecuting = executing === key;
                  const isSender = payment.sender?.toLowerCase() === walletAddr;
                  const isRecipient = payment.recipient?.toLowerCase() === walletAddr;
                  const status = getPaymentStatus(payment, walletAddr, txMap);
                  const isSending = status === "sending";

                  return (
                    <div
                      key={key}
                      className={`p-5 rounded-xl border transition-colors ${
                        isSending
                          ? "bg-blue-500/5 border-blue-500/20"
                          : isExecuting
                          ? "bg-violet-500/5 border-violet-500/15"
                          : "bg-emerald-500/5 border-emerald-500/15 hover:border-emerald-500/25"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {isSending || isExecuting ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-violet-400 bg-violet-400/8 border border-violet-400/15">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {isExecuting && execPhase
                                  ? PHASE_LABELS[execPhase]
                                  : "Processing…"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-cyan-400 bg-cyan-400/8 border border-cyan-400/15">
                                <Zap className="w-3 h-3" />
                                Ready
                              </span>
                            )}
                            <span className="text-xs text-gray-500">Payment #{key}</span>
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

                        {/* Action button — only sender can execute */}
                        {isSending && (
                          <Loader2 className="shrink-0 w-5 h-5 text-blue-400 animate-spin" />
                        )}

                        {!isSending && isSender && (
                          <button
                            onClick={() => handleExecute(payment)}
                            disabled={executing !== null}
                            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-600/15"
                          >
                            {isExecuting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {execPhase === "decrypting"
                                  ? "Decrypting…"
                                  : execPhase === "publishing"
                                  ? "Publishing…"
                                  : "Sending…"}
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
                const isSender = payment.sender?.toLowerCase() === walletAddr;
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
                const key = String(payment.id ?? "?");
                const isRecipient = payment.recipient?.toLowerCase() === walletAddr;
                const isSender = payment.sender?.toLowerCase() === walletAddr;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-white/[0.02] border border-white/5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-gray-300 font-mono font-medium flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-violet-400" />
                            Encrypted
                          </span>
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
                          Payment #{key} · Unlocked{" "}
                          {payment.unlockTime ? formatUnlockTime(payment.unlockTime) : "—"}
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
