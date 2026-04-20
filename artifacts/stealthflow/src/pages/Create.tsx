/**
 * Create.tsx
 * Form to schedule a new encrypted payment.
 * Migrated to @cofhe/sdk (v0.4.0) — cofhejs deprecated.
 * Upgrades: ENS resolution, payment memos, more presets, soft self-payment warning,
 *           payment request link generation, URL pre-fill support.
 */

import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import {
  Lock,
  Clock,
  User,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Info,
  Link2,
  Check,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Contract, parseEther } from "ethers";
import WalletGate from "@/components/WalletGate";
import PrivacyModal from "@/components/PrivacyModal";
import type { WalletInfo } from "@/lib/wallet";
import {
  CONTRACT_ADDRESS,
  CONTRACT_DEPLOYED,
  ETH_SEPOLIA,
  STEALTH_WALLET_ABI,
  formatCountdown,
} from "@/lib/contract";
import { createCofheConfig, createCofheClient } from "@cofhe/sdk/web";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";
import { Encryptable } from "@cofhe/sdk";
import { resolveEns, isEnsName } from "@/lib/ens";
import { saveLabelPending } from "@/lib/labels";

interface CreateProps {
  wallet: WalletInfo | null;
  onConnect: (w: WalletInfo) => void;
}

type Step = "idle" | "encrypting" | "sending" | "confirming" | "done";

const STEP_LABELS: Record<Step, string> = {
  idle: "Create Confidential Payment",
  encrypting: "Encrypting amount with FHE…",
  sending: "Sending confidential transaction…",
  confirming: "Waiting for on-chain confirmation…",
  done: "Confidential payment scheduled!",
};

const PRESETS = [
  { label: "1 min", seconds: 60 },
  { label: "1 hr", seconds: 3600 },
  { label: "1 day", seconds: 86400 },
  { label: "3 days", seconds: 259200 },
  { label: "1 week", seconds: 604800 },
  { label: "30 days", seconds: 2592000 },
];

export default function Create({ wallet, onConnect }: CreateProps) {
  const [, navigate] = useLocation();
  const search = useSearch();

  // Parse URL query params for payment request pre-fill
  const params = new URLSearchParams(search);
  const prefillRecipient = params.get("recipient") ?? "";
  const prefillAmount = params.get("amount") ?? "";
  const prefillDelay = params.get("delay") ?? "";
  const prefillMemo = params.get("memo") ?? "";

  const [amount, setAmount] = useState(prefillAmount);
  const [delay, setDelay] = useState(prefillDelay);
  const [recipient, setRecipient] = useState(prefillRecipient);
  const [memo, setMemo] = useState(prefillMemo);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [encryptTime, setEncryptTime] = useState(0);

  // ENS resolution state
  const [ensInput, setEnsInput] = useState(isEnsName(prefillRecipient) ? prefillRecipient : "");
  const [ensResolved, setEnsResolved] = useState(isEnsName(prefillRecipient) ? prefillRecipient : "");
  const [ensLoading, setEnsLoading] = useState(false);
  const [ensError, setEnsError] = useState("");
  const ensDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Copy payment request link
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (step === "encrypting") {
      setEncryptTime(0);
      interval = setInterval(() => setEncryptTime((t) => t + 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step]);

  // ENS debounced resolution
  const handleRecipientChange = (value: string) => {
    setRecipient(value);
    setEnsError("");

    if (isEnsName(value)) {
      setEnsInput(value);
      setEnsResolved("");
      if (ensDebounceRef.current) clearTimeout(ensDebounceRef.current);
      ensDebounceRef.current = setTimeout(async () => {
        setEnsLoading(true);
        const address = await resolveEns(value);
        setEnsLoading(false);
        if (address) {
          setEnsResolved(address);
          setRecipient(address);
        } else {
          setEnsError("ENS name not found or could not be resolved.");
        }
      }, 600);
    } else {
      setEnsInput("");
      setEnsResolved("");
    }
  };

  const delayNum = parseInt(delay, 10) || 0;
  const isLoading = step !== "idle" && step !== "done";
  const isSelfPayment =
    wallet && recipient && /^0x[0-9a-fA-F]{40}$/.test(recipient) &&
    recipient.toLowerCase() === wallet.address.toLowerCase();

  const validate = (): string | null => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) return "Amount must be a positive number.";
    if (!delay || delayNum < 60)
      return "Unlock delay must be at least 60 seconds to ensure the transaction mines before the deadline.";
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) return "Enter a valid Ethereum address (or a .eth ENS name).";
    return null;
  };

  const handleSubmit = async () => {
    setError("");
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setStep("encrypting");

      if (!CONTRACT_DEPLOYED || !wallet) {
        throw new Error("Contract not deployed or wallet not connected");
      }
      if (!wallet.signer.provider) throw new Error("Wallet provider not found");

      // Initialize the new @cofhe/sdk client via ethers6 adapter
      const { publicClient, walletClient } = await Ethers6Adapter(
        wallet.signer.provider,
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

      // Encrypt the payment amount using FHE
      const amountWei = BigInt(Math.round(parseFloat(amount) * 1e18));
      const [encryptedItem] = await cofheClient
        .encryptInputs([Encryptable.uint64(amountWei)])
        .setAccount(wallet.address)
        .setChainId(ETH_SEPOLIA.chainIdNum)
        .execute();

      const unlockTimestamp = Math.floor(Date.now() / 1000) + delayNum;

      setStep("sending");

      const contract = new Contract(CONTRACT_ADDRESS, STEALTH_WALLET_ABI, wallet.signer);
      const tx = (await contract.setPayment(
        {
          ctHash: encryptedItem.ctHash,
          securityZone: encryptedItem.securityZone,
          utype: encryptedItem.utype,
          signature: encryptedItem.signature,
        },
        unlockTimestamp,
        recipient,
        { value: parseEther(amount) },
      )) as { hash: string; wait: () => Promise<unknown> };

      setStep("confirming");
      await tx.wait();

      // Save memo locally with unlock timestamp + recipient as the key.
      // Dashboard will promote this to payment:{id} once the ID is known.
      if (memo.trim()) {
        saveLabelPending(unlockTimestamp, recipient, memo.trim());
      }

      setStep("done");
      toast.success("Payment scheduled!", {
        description: `${parseFloat(amount).toFixed(4)} ETH locked in contract · unlocks in ${formatCountdown(delayNum)}`,
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 1200);
    } catch (err: unknown) {
      const friendlyMsg = parseTxError(err);
      setError(friendlyMsg);
      setStep("idle");
      toast.error("Failed to schedule payment", { description: friendlyMsg });
    }
  };

  const parseTxError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    const lower = raw.toLowerCase();

    if (lower.includes("insufficient funds") || lower.includes("insufficient_funds"))
      return "Insufficient balance. Your wallet does not have enough ETH to cover the payment amount plus gas fees.";
    if (
      lower.includes("user rejected") ||
      lower.includes("user denied") ||
      lower.includes("action_rejected")
    )
      return "Transaction was rejected in your wallet.";
    if (lower.includes("nonce"))
      return "Transaction nonce conflict. Please reset your wallet activity or wait for pending transactions to confirm.";
    if (lower.includes("gas") && lower.includes("exceed"))
      return "Gas estimation failed. The transaction may revert on-chain. Please check your inputs.";
    if (lower.includes("network") || lower.includes("disconnect"))
      return "Network error. Please check your connection and ensure you are on Ethereum Sepolia.";
    if (lower.includes("encrypt")) return "FHE encryption failed: " + raw;

    if (raw.length > 120) return "Transaction failed. Please check your balance and try again.";
    return raw;
  };

  const handleCopyPaymentRequest = () => {
    if (!wallet) return;
    const base = window.location.origin;
    const p = new URLSearchParams();
    p.set("recipient", wallet.address);
    if (amount) p.set("amount", amount);
    if (delay) p.set("delay", delay);
    if (memo) p.set("memo", memo);
    const url = `${base}/create?${p.toString()}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    toast.success("Payment request link copied!", {
      description: "Share this link so someone can send you an encrypted payment.",
    });
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <>
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <WalletGate wallet={wallet} onConnect={onConnect}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Create Confidential Payment</h1>
            <p className="text-sm text-gray-500 mt-1">
              Amount is encrypted with FHE before being stored on-chain. Only you and the recipient
              can view payment details.{" "}
              <button
                onClick={() => setPrivacyOpen(true)}
                className="text-violet-400 hover:text-violet-300 transition-colors"
              >
                Learn how →
              </button>
            </p>
          </div>

          <div className="space-y-5">
            {/* Amount field */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                <Lock className="w-3 h-3 text-violet-400" />
                Amount (ETH)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 rounded-xl bg-white/4 border border-white/8 text-white placeholder-gray-700 text-sm focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/15 transition-all disabled:opacity-50"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                  <Lock className="w-3 h-3 text-violet-400" />
                  <span className="text-xs text-violet-400 font-medium">Encrypted</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-violet-500" />
                This value will be encrypted before leaving your browser
              </p>
              {amount && parseFloat(amount) > 0 && (
                <p className="text-xs text-cyan-500/80 flex items-center gap-1">
                  <Info className="w-3 h-3 text-cyan-500" />
                  {parseFloat(amount).toFixed(4)} ETH will be held in the contract and released to
                  the recipient on execution
                </p>
              )}
            </div>

            {/* Delay field */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                <Clock className="w-3 h-3 text-cyan-400" />
                Unlock Delay (seconds)
              </label>

              <div className="flex flex-wrap gap-2 mb-2">
                {PRESETS.map(({ label, seconds }) => (
                  <button
                    key={label}
                    onClick={() => setDelay(String(seconds))}
                    disabled={isLoading}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
                      delay === String(seconds)
                        ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-300"
                        : "bg-white/4 border-white/8 text-gray-400 hover:text-gray-200 hover:bg-white/6"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min="60"
                step="1"
                placeholder="3600"
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
                disabled={isLoading}
                className={`w-full px-4 py-3 rounded-xl bg-white/4 border text-white placeholder-gray-700 text-sm focus:outline-none focus:ring-1 transition-all disabled:opacity-50 ${
                  delay && delayNum < 60
                    ? "border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20"
                    : "border-white/8 focus:border-cyan-500/40 focus:ring-cyan-500/15"
                }`}
              />
              {delayNum > 0 && delayNum < 60 ? (
                <p className="text-xs text-red-400">Minimum unlock delay is 60 seconds.</p>
              ) : delayNum >= 60 ? (
                <p className="text-xs text-gray-500">
                  Unlocks in{" "}
                  <span className="text-gray-300 font-medium">{formatCountdown(delayNum)}</span>
                </p>
              ) : null}
            </div>

            {/* Recipient field */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                <User className="w-3 h-3 text-gray-400" />
                Recipient Address or ENS Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="0x... or name.eth"
                  value={ensInput || recipient}
                  onChange={(e) => handleRecipientChange(e.target.value)}
                  disabled={isLoading}
                  className={`w-full px-4 py-3 rounded-xl bg-white/4 border text-white placeholder-gray-700 text-sm font-mono focus:outline-none focus:ring-1 transition-all disabled:opacity-50 ${
                    ensError
                      ? "border-red-500/40 focus:border-red-500/40 focus:ring-red-500/15"
                      : ensResolved
                      ? "border-emerald-500/30 focus:border-emerald-500/40 focus:ring-emerald-500/15"
                      : "border-white/8 focus:border-violet-500/40 focus:ring-violet-500/15"
                  }`}
                />
                {ensLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                  </div>
                )}
                {ensResolved && !ensLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                )}
              </div>
              {ensResolved && (
                <p className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                  <Check className="w-3 h-3" />
                  Resolved: {ensResolved.slice(0, 10)}…{ensResolved.slice(-8)}
                </p>
              )}
              {ensError && (
                <p className="text-xs text-red-400">{ensError}</p>
              )}
              {isSelfPayment && (
                <div className="flex items-start gap-1.5 text-xs text-amber-400/90 mt-1">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  You're sending to your own address. This is allowed but you won't receive a separate "incoming" notification.
                </div>
              )}
            </div>

            {/* Memo field */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                <MessageSquare className="w-3 h-3 text-gray-500" />
                Memo (optional, stored locally)
              </label>
              <input
                type="text"
                placeholder="e.g. Rent · July, Project milestone, Gift..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                disabled={isLoading}
                maxLength={120}
                className="w-full px-4 py-3 rounded-xl bg-white/4 border border-white/8 text-white placeholder-gray-700 text-sm focus:outline-none focus:border-white/15 focus:ring-1 focus:ring-white/8 transition-all disabled:opacity-50"
              />
              <p className="text-xs text-gray-700">
                Never stored on-chain. Only visible on this device.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/15 text-sm text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Contract not deployed notice */}
            {!CONTRACT_DEPLOYED && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-white/3 border border-white/6 text-xs text-gray-500">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-600" />
                Contract not yet deployed to a live network. Deploy{" "}
                <code className="text-gray-400">StealthWallet.sol</code> and update{" "}
                <code className="text-gray-400">CONTRACT_ADDRESS</code> in{" "}
                <code className="text-gray-400">src/lib/contract.ts</code>.
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={isLoading || ensLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-violet-600/20 hover:shadow-violet-600/35"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {step === "encrypting"
                    ? `Encrypting amount with FHE... (${encryptTime}s)`
                    : STEP_LABELS[step]}
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  {STEP_LABELS[step]}
                </>
              )}
            </button>

            {/* Progress steps */}
            {isLoading && (
              <div className="flex items-center justify-center gap-2">
                {(["encrypting", "sending", "confirming"] as Step[]).map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full transition-colors ${
                        step === s
                          ? "bg-violet-400"
                          : step === "confirming" && s !== "confirming"
                          ? "bg-violet-600/50"
                          : step === "sending" && s === "encrypting"
                          ? "bg-violet-600/50"
                          : "bg-white/10"
                      }`}
                    />
                    {s !== "confirming" && <div className="w-6 h-px bg-white/10" />}
                  </div>
                ))}
              </div>
            )}

            {/* Payment Request Link */}
            {wallet && !isLoading && (
              <div className="pt-2 border-t border-white/6">
                <p className="text-xs text-gray-600 mb-2">
                  Want someone to pay <span className="text-gray-500 font-medium">you</span>? Generate a pre-filled link they can open.
                </p>
                <button
                  onClick={handleCopyPaymentRequest}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl w-full bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/12 text-gray-400 hover:text-gray-200 text-sm transition-all"
                >
                  {linkCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                  )}
                  {linkCopied ? "Link copied!" : "Copy payment request link"}
                </button>
              </div>
            )}
          </div>
        </div>
      </WalletGate>
    </>
  );
}
