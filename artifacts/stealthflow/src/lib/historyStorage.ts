/**
 * historyStorage.ts
 * Per-wallet localStorage caching for payment history.
 * Handles BigInt ↔ string serialization for JSON compatibility.
 */

import type { ContractPayment } from "@/pages/Dashboard";

export function historyKey(walletAddr: string): string {
  return `stealthflow_history_${walletAddr.toLowerCase()}`;
}

export function receiptsKey(walletAddr: string): string {
  return `stealthflow_receipts_${walletAddr.toLowerCase()}`;
}

export function saveHistory(key: string, payments: ContractPayment[]): void {
  try {
    const serialized = payments.map((p) => ({
      ...p,
      id: p.id?.toString() ?? "0",
      unlockTime: p.unlockTime?.toString() ?? "0",
    }));
    localStorage.setItem(key, JSON.stringify(serialized));
  } catch {
    // Storage quota exceeded or unavailable — silently ignore
  }
}

export function loadHistory(key: string): ContractPayment[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    return parsed.map((p) => ({
      id: BigInt(String(p.id)),
      encryptedAmount: String(p.encryptedAmount),
      unlockTime: BigInt(String(p.unlockTime)),
      recipient: String(p.recipient),
      sender: String(p.sender),
      executed: Boolean(p.executed),
    }));
  } catch {
    return [];
  }
}

export function clearHistoryKeys(...keys: string[]): void {
  keys.forEach((k) => localStorage.removeItem(k));
}
