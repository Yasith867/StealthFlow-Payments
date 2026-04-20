/**
 * Landing.tsx
 * Hero landing page for StealthFlow.
 */

import { useState } from "react";
import { Link } from "wouter";
import { Shield, Lock, Clock, Zap, ArrowRight, ChevronRight, Eye, EyeOff, ExternalLink } from "lucide-react";
import PrivacyModal from "@/components/PrivacyModal";

const FEATURES = [
  {
    icon: Lock,
    color: "violet",
    title: "Selective Disclosure",
    desc: "Only the sender and recipient can view payment details. All other parties see encrypted ciphertext. Nothing more.",
  },
  {
    icon: Clock,
    color: "cyan",
    title: "Programmable Conditions",
    desc: "Set time-lock conditions. The smart contract computes directly on encrypted data without ever decrypting it.",
  },
  {
    icon: Zap,
    color: "emerald",
    title: "Verifiable On-Chain",
    desc: "Every confidential transfer is verified on-chain. No intermediaries, no trust assumptions, no data exposure.",
  },
];

const COLOR_MAP = {
  violet: {
    bg: "bg-violet-500/8",
    icon: "text-violet-400",
    border: "border-violet-500/12",
    glow: "shadow-violet-500/10",
  },
  cyan: {
    bg: "bg-cyan-500/8",
    icon: "text-cyan-400",
    border: "border-cyan-500/12",
    glow: "shadow-cyan-500/10",
  },
  emerald: {
    bg: "bg-emerald-500/8",
    icon: "text-emerald-400",
    border: "border-emerald-500/12",
    glow: "shadow-emerald-500/10",
  },
};

// A realistic-looking Sepolia Etherscan tx mock demonstrating FHE privacy
function PrivacyProofPanel() {
  const [revealed, setRevealed] = useState(false);

  return (
    <section className="max-w-5xl mx-auto px-4 pb-24">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold text-white mb-3">Privacy by default — proven on-chain</h2>
        <p className="text-gray-500 text-sm max-w-lg mx-auto">
          Anyone can inspect the contract on Etherscan. Here's what they see vs. what you see.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* What the world sees */}
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.03] border-b border-white/6">
            <Eye className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs font-medium text-gray-400">What the world sees on Etherscan</span>
          </div>
          <div className="p-4 font-mono text-xs space-y-3">
            <div className="space-y-1">
              <p className="text-gray-600 uppercase tracking-wide text-[10px]">Function</p>
              <p className="text-gray-300">setPayment</p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 uppercase tracking-wide text-[10px]">Encrypted Amount (ctHash)</p>
              <p className="text-amber-400/80 break-all leading-relaxed">
                0x7f4a2c1d9e3b8f0a…e291bc74
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 uppercase tracking-wide text-[10px]">Security Zone</p>
              <p className="text-gray-400">0</p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 uppercase tracking-wide text-[10px]">Unlock Time</p>
              <p className="text-gray-400">1744041600</p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 uppercase tracking-wide text-[10px]">Recipient</p>
              <p className="text-gray-400">0xRecipient…Address</p>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5">
              <a
                href="https://sepolia.etherscan.io/address/0x7091056ca13fd6a2e09d0bc4944e87a0b6b909cb"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                View real contract on Sepolia Etherscan
              </a>
            </div>
          </div>
        </div>

        {/* What you see in StealthFlow */}
        <div className="rounded-2xl border border-violet-500/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-violet-500/6 border-b border-violet-500/15">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-300">What you see in StealthFlow</span>
            </div>
            <button
              onClick={() => setRevealed((r) => !r)}
              className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
            >
              {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {revealed ? "Hide" : "Reveal"}
            </button>
          </div>
          <div className="p-4 font-mono text-xs space-y-3">
            <div className="space-y-1">
              <p className="text-gray-600 uppercase tracking-wide text-[10px]">Payment</p>
              <p className="text-gray-300">#42 · Confidential Transfer</p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 uppercase tracking-wide text-[10px]">Amount</p>
              {revealed ? (
                <p className="text-emerald-400 font-bold text-sm">0.1500 ETH</p>
              ) : (
                <p className="text-violet-300/70 flex items-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  Encrypted — only you can see this
                </p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 uppercase tracking-wide text-[10px]">Unlock Time</p>
              <p className="text-gray-400">Apr 7, 2025, 12:00 PM</p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 uppercase tracking-wide text-[10px]">Recipient</p>
              <p className="text-gray-400">0xRecipient…Address</p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 uppercase tracking-wide text-[10px]">Status</p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
                <Zap className="w-2.5 h-2.5" />
                Ready to execute
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-gray-600 mt-4">
        The encrypted ciphertext (ctHash) is computed using{" "}
        <span className="text-gray-500">Fhenix CoFHE</span> — a Threshold FHE system.
        The smart contract operates on the encrypted value without ever decrypting it on-chain.
      </p>
    </section>
  );
}

export default function Landing() {
  const [privacyOpen, setPrivacyOpen] = useState(false);

  return (
    <>
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />

      <div className="min-h-screen">
        {/* Hero */}
        <section className="relative overflow-hidden pt-20 pb-24 px-4">
          {/* Background glows */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/10 blur-[120px] rounded-full" />
            <div className="absolute top-32 right-1/4 w-[300px] h-[300px] bg-cyan-600/8 blur-[100px] rounded-full" />
          </div>

          <div className="relative max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-8">
              <Shield className="w-3 h-3" />
              Powered by Fhenix Fully Homomorphic Encryption
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold text-white tracking-tight leading-[1.08] mb-6">
              Confidential Payments
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                Fully Encrypted
              </span>
            </h1>

            <p className="text-lg text-gray-400 leading-relaxed max-w-xl mx-auto mb-10">
              Confidential payment infrastructure powered by Fully Homomorphic Encryption.
              Execute programmable financial flows while keeping sensitive data encrypted and verifiable on-chain.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <Link href="/create">
                <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all shadow-lg shadow-violet-600/25 hover:shadow-violet-600/40">
                  Create Confidential Payment
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <button
                onClick={() => setPrivacyOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-gray-300 text-sm font-medium transition-colors"
              >
                How does FHE work?
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Privacy badges */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/8 border border-violet-500/15 text-violet-300 text-xs font-medium">
                <Lock className="w-3 h-3" /> Encrypted
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/8 border border-cyan-500/15 text-cyan-300 text-xs font-medium">
                <Zap className="w-3 h-3" /> Programmable
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/8 border border-emerald-500/15 text-emerald-300 text-xs font-medium">
                <Shield className="w-3 h-3" /> Verifiable
              </span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-4 pb-24">
          <div className="grid sm:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, color, title, desc }) => {
              const c = COLOR_MAP[color as keyof typeof COLOR_MAP];
              return (
                <div
                  key={title}
                  className={`group p-6 rounded-2xl border ${c.border} ${c.bg} hover:shadow-xl ${c.glow} transition-all`}
                >
                  <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ${c.icon}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-5xl mx-auto px-4 pb-24">
          <h2 className="text-2xl font-bold text-white text-center mb-3">How it works</h2>
          <p className="text-gray-500 text-center text-sm mb-10">Three steps to a private payment</p>
          <div className="relative grid sm:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Encrypt",
                desc: "Enter the amount. It's encrypted client-side using FHE before leaving your browser. It never leaves in plaintext.",
                color: "violet",
              },
              {
                step: "02",
                title: "Schedule",
                desc: "The encrypted ciphertext, unlock condition, and recipient are stored on-chain. Only authorised parties can access details.",
                color: "cyan",
              },
              {
                step: "03",
                title: "Execute Confidential Transfer",
                desc: "When the condition is met, execute the transfer. The smart contract computes on encrypted data. The amount stays private.",
                color: "emerald",
              },
            ].map(({ step, title, desc, color }) => {
              const c = COLOR_MAP[color as keyof typeof COLOR_MAP];
              return (
                <div key={step} className="relative text-center">
                  <div className={`inline-flex w-12 h-12 rounded-2xl ${c.bg} border ${c.border} items-center justify-center mb-4`}>
                    <span className={`text-sm font-bold ${c.icon}`}>{step}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Privacy Proof Panel */}
        <PrivacyProofPanel />

        {/* CTA */}
        <section className="max-w-5xl mx-auto px-4 pb-24">
          <div className="relative rounded-2xl overflow-hidden border border-violet-500/15 bg-gradient-to-br from-violet-500/8 to-cyan-500/5 p-10 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-transparent pointer-events-none" />
            <h2 className="relative text-2xl font-bold text-white mb-3">Ready to go confidential?</h2>
            <p className="relative text-gray-400 text-sm mb-6 max-w-md mx-auto">
              Create your first confidential payment in under a minute. All computations run on encrypted data. Nothing is revealed.
            </p>
            <Link href="/create">
              <button className="relative inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all shadow-lg shadow-violet-600/25">
                Create Confidential Payment
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
