/**
 * PrivacyModal.tsx
 * Animated modal explaining how Fully Homomorphic Encryption protects payment amounts.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Eye, Server, Key, Shield } from "lucide-react";

interface PrivacyModalProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    icon: Lock,
    emoji: "🔐",
    color: "violet",
    title: "Client-Side Encryption",
    bullets: [
      "Amount encrypted in your browser before leaving",
      "Plaintext never sent over the network",
      "Uses Fhenix's FHE library locally",
    ],
  },
  {
    icon: Server,
    emoji: "📦",
    color: "cyan",
    title: "Encrypted On-Chain Storage",
    bullets: [
      "Stored as opaque ciphertext on-chain",
      "Blockchain nodes cannot read the value",
      "Only the FHE co-processor can compute on it",
    ],
  },
  {
    icon: Eye,
    emoji: "👁️",
    color: "emerald",
    title: "Zero Knowledge to Observers",
    bullets: [
      "Explorers and validators see only ciphertext",
      "Amount is indistinguishable from random data",
      "No metadata leaks the true value",
    ],
  },
  {
    icon: Key,
    emoji: "🔑",
    color: "amber",
    title: "Pre-Execution Privacy",
    bullets: [
      "Amounts hidden entirely while scheduled",
      "Only unsealed securely at exact moment of execution",
      "Protecting your balance history from observers",
    ],
  },
];

const COLOR_MAP = {
  violet: {
    bg: "bg-violet-500/8",
    icon: "text-violet-400",
    border: "border-violet-500/15",
    dot: "bg-violet-400",
  },
  cyan: {
    bg: "bg-cyan-500/8",
    icon: "text-cyan-400",
    border: "border-cyan-500/15",
    dot: "bg-cyan-400",
  },
  emerald: {
    bg: "bg-emerald-500/8",
    icon: "text-emerald-400",
    border: "border-emerald-500/15",
    dot: "bg-emerald-400",
  },
  amber: {
    bg: "bg-amber-500/8",
    icon: "text-amber-400",
    border: "border-amber-500/15",
    dot: "bg-amber-400",
  },
};

export default function PrivacyModal({ open, onClose }: PrivacyModalProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Modal panel */}
          <motion.div
            className="relative w-full max-w-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 32 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 32 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow */}
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-violet-500/20 via-transparent to-cyan-500/15 pointer-events-none" />

            <div className="relative bg-gradient-to-br from-[#0e0e1c] to-[#0a0a18] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/15 border border-violet-500/20 flex items-center justify-center">
                    <Shield className="w-4.5 h-4.5 text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white leading-tight">
                      How FHE Works
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Fully Homomorphic Encryption. Your privacy guarantee.
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/6 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-4 scrollbar-thin">

                {/* Intro */}
                <p className="text-sm text-gray-400 leading-relaxed">
                  <span className="text-white font-medium">FHE</span> lets a smart contract compute
                  on encrypted data, without ever seeing the underlying values. Here's how that
                  protects you:
                </p>

                {/* Step cards */}
                <div className="grid sm:grid-cols-2 gap-3">
                  {STEPS.map(({ emoji, color, title, bullets }, i) => {
                    const c = COLOR_MAP[color as keyof typeof COLOR_MAP];
                    return (
                      <motion.div
                        key={title}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 + i * 0.06, duration: 0.22, ease: "easeOut" }}
                        className={`p-4 rounded-xl border ${c.border} ${c.bg} hover:scale-[1.02] transition-transform cursor-default`}
                      >
                        <div className="flex items-center gap-2 mb-2.5">
                          <span className="text-lg leading-none">{emoji}</span>
                          <p className="text-sm font-semibold text-white">{title}</p>
                        </div>
                        <ul className="space-y-1.5">
                          {bullets.map((b) => (
                            <li key={b} className="flex items-start gap-2 text-xs text-gray-400">
                              <span className={`w-1 h-1 rounded-full ${c.dot} mt-1.5 shrink-0`} />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Fhenix CoFHE note */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.025] border border-white/6">
                  <span className="text-base leading-none mt-0.5">⚡</span>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    StealthFlow is powered by{" "}
                    <span className="text-violet-300 font-medium">Fhenix CoFHE</span>, a
                    Collaborative FHE system that enables private smart contracts on a public
                    blockchain. The Fhenix network co-processor holds the FHE key and handles
                    all encrypted computation on behalf of the contract.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/6 flex items-center justify-between gap-4">
                <p className="text-xs text-gray-600">
                  Your amounts are always encrypted · Always private
                </p>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors shadow-lg shadow-violet-600/20"
                >
                  Got it
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
