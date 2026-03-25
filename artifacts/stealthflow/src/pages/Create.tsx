/**
 * Create.tsx
 * Form to schedule a new encrypted payment.
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Lock,
  Clock,
  User,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Contract, parseEther } from "ethers";
import WalletGate from "@/components/WalletGate";
import PrivacyModal from "@/components/PrivacyModal";
import type { WalletInfo } from "@/lib/wallet";
import {
  CONTRACT_ADDRESS,
  CONTRACT_DEPLOYED,
  STEALTH_WALLET_ABI,
  formatCountdown,
} from "@/lib/contract";
// @ts-ignore
import { cofhejs, Encryptable } from "cofhejs/web";

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
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86400 },
  { label: "1 week", seconds: 604800 },
];

export default function Create({ wallet, onConnect }: CreateProps) {
  const [, navigate] = useLocation();
  const [amount, setAmount] = useState("");
  const [delay, setDelay] = useState("");
  const [recipient, setRecipient] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [encryptTime, setEncryptTime] = useState(0);

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

  const delayNum = parseInt(delay, 10) || 0;
  const isLoading = step !== "idle" && step !== "done";

  const validate = (): string | null => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) return "Amount must be a positive number.";
    if (!delay || delayNum < 60) return "Unlock delay must be at least 60 seconds to ensure the transaction mines before the deadline.";
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) return "Enter a valid Ethereum address.";
    if (wallet && recipient.toLowerCase() === wallet.address.toLowerCase())
      return "You cannot send a payment to your own wallet address.";
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

      let txHash: string | undefined;

      if (CONTRACT_DEPLOYED && wallet) {
        if (!wallet.signer.provider) throw new Error("Wallet provider not found");

        const initRes = await cofhejs.initializeWithEthers({
          ethersProvider: wallet.signer.provider,
          ethersSigner: wallet.signer,
          environment: "TESTNET",
          generatePermit: false,
        });
        if (!initRes.success) {
          console.error("[cofhejs] init error object:", initRes.error);
          console.error("[cofhejs] init error code:", initRes.error?.code);
          console.error("[cofhejs] init error cause:", initRes.error?.cause);
          const detail = initRes.error?.cause?.message || initRes.error?.message || "Unknown error";
          throw new Error("coFhe initialization failed: " + detail);
        }

        const amountWei = BigInt(Math.round(parseFloat(amount) * 1e18));
        const encRes = await cofhejs.encrypt([Encryptable.uint64(amountWei)]);
        
        if (!encRes.success) throw new Error("FHE Encryption failed: " + encRes.error.message);
        
        const encryptedValue = encRes.data[0];
        const unlockTimestamp = Math.floor(Date.now() / 1000) + delayNum;

        setStep("sending");

        const contract = new Contract(CONTRACT_ADDRESS, STEALTH_WALLET_ABI, wallet.signer);
        // Send actual ETH alongside the call — the contract holds it until execution
        const tx = await contract.setPayment(
          {
            ctHash: encryptedValue.ctHash,
            securityZone: encryptedValue.securityZone,
            utype: encryptedValue.utype,
            signature: encryptedValue.signature,
          },
          unlockTimestamp,
          recipient,
          { value: parseEther(amount) }
        ) as { hash: string; wait: () => Promise<unknown> };
        txHash = tx.hash;
        setStep("confirming");
        await tx.wait();
      } else {
        throw new Error("Contract not deployed or wallet not connected");
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

  /** Translate raw ethers / RPC errors into user-friendly messages */
  const parseTxError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    const lower = raw.toLowerCase();

    if (lower.includes("insufficient funds") || lower.includes("insufficient_funds"))
      return "Insufficient balance. Your wallet does not have enough ETH to cover the payment amount plus gas fees.";
    if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("action_rejected"))
      return "Transaction was rejected in your wallet.";
    if (lower.includes("nonce"))
      return "Transaction nonce conflict. Please reset your wallet activity or wait for pending transactions to confirm.";
    if (lower.includes("gas") && lower.includes("exceed"))
      return "Gas estimation failed. The transaction may revert on-chain. Please check your inputs.";
    if (lower.includes("network") || lower.includes("disconnect"))
      return "Network error. Please check your connection and ensure you are on Ethereum Sepolia.";
    if (lower.includes("cofhe initialization failed"))
      return raw;
    if (lower.includes("fhe encryption failed"))
      return raw;

    // Fallback: strip technical noise
    if (raw.length > 120) return "Transaction failed. Please check your balance and try again.";
    return raw;
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
              Amount is encrypted with FHE before being stored on-chain. Only you and the recipient can view payment details.{" "}
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
                  {parseFloat(amount).toFixed(4)} ETH will be held in the contract and released to the recipient on execution
                </p>
              )}
            </div>

            {/* Delay field */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                <Clock className="w-3 h-3 text-cyan-400" />
                Unlock Delay (seconds)
              </label>

              {/* Presets */}
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
                <p className="text-xs text-red-400">
                  Minimum unlock delay is 60 seconds.
                </p>
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
                Recipient Address
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl bg-white/4 border border-white/8 text-white placeholder-gray-700 text-sm font-mono focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/15 transition-all disabled:opacity-50"
              />
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
                Contract not yet deployed to a live network. Payment will be recorded locally.
                Deploy <code className="text-gray-400">StealthWallet.sol</code> and update{" "}
                <code className="text-gray-400">CONTRACT_ADDRESS</code> in{" "}
                <code className="text-gray-400">src/lib/contract.ts</code>.
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-violet-600/20 hover:shadow-violet-600/35"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {step === "encrypting" ? `Encrypting amount with FHE... (${encryptTime}s)` : STEP_LABELS[step]}
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
                    {s !== "confirming" && (
                      <div className="w-6 h-px bg-white/10" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </WalletGate>
    </>
  );
}
