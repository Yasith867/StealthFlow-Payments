import type { ContractPayment } from "@/pages/Dashboard";

export type PaymentStatus =
  | "sending"   // sender: tx submitted, awaiting on-chain confirmation
  | "sent"      // sender: confirmed executed on-chain
  | "incoming"  // recipient: not yet executed
  | "received"  // recipient: confirmed executed on-chain
  | "ready"     // sender: unlock time passed, not yet executed
  | "pending"   // sender: still locked (unlock time in the future)
  | "hidden";   // not authorized to see this payment

export function getPaymentStatus(
  payment: ContractPayment,
  walletAddr: string,
  txMap: Record<string, string>
): PaymentStatus {
  const isSender    = payment.sender?.toLowerCase()    === walletAddr;
  const isRecipient = payment.recipient?.toLowerCase() === walletAddr;
  const id          = String(payment.id ?? "?");
  const unlocked    = Date.now() / 1000 >= Number(payment.unlockTime);

  if (isSender) {
    if (payment.executed) return "sent";
    if (txMap[id])        return "sending";
    if (unlocked)         return "ready";
    return "pending";
  }

  if (isRecipient) {
    if (payment.executed) return "received";
    return "incoming";
  }

  return "hidden";
}
