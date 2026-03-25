/**
 * storage.ts
 * Local transaction history stored in localStorage.
 * Persists payment records so users can track their scheduled payments.
 */

export type PaymentStatus = "pending" | "executed" | "cancelled";

export interface PaymentRecord {
  id: string;
  recipient: string;
  amountLabel: string;
  unlockTime: number;
  scheduledAt: number;
  status: PaymentStatus;
  txHash?: string;
  executedAt?: number;
}

const STORAGE_KEY = "stealthflow_payments";

export function getPayments(): PaymentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PaymentRecord[];
  } catch {
    return [];
  }
}

export function savePayment(payment: PaymentRecord): void {
  const payments = getPayments();
  const existing = payments.findIndex((p) => p.id === payment.id);
  if (existing >= 0) {
    payments[existing] = payment;
  } else {
    payments.unshift(payment);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payments));
}

export function markExecuted(id: string, txHash?: string): void {
  const payments = getPayments();
  const idx = payments.findIndex((p) => p.id === id);
  if (idx >= 0) {
    payments[idx].status = "executed";
    payments[idx].executedAt = Date.now();
    if (txHash) payments[idx].txHash = txHash;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payments));
  }
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getPendingPayments(): PaymentRecord[] {
  return getPayments().filter((p) => p.status === "pending");
}

export function getReadyPayments(): PaymentRecord[] {
  const now = Date.now() / 1000;
  return getPayments().filter(
    (p) => p.status === "pending" && p.unlockTime <= now
  );
}
