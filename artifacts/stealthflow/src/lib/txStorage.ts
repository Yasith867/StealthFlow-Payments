const TX_MAP_KEY = "stealthflow_txmap";
const DECRYPT_PENDING_KEY = "stealthflow_decrypt_pending";

export function saveTxHash(paymentId: string, txHash: string): void {
  try {
    const existing = JSON.parse(localStorage.getItem(TX_MAP_KEY) ?? "{}") as Record<string, string>;
    existing[paymentId] = txHash;
    localStorage.setItem(TX_MAP_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }
}

export function loadTxMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TX_MAP_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/** Mark a payment as "decrypt requested, waiting for oracle" */
export function markDecryptPending(paymentId: string): void {
  try {
    const existing = JSON.parse(localStorage.getItem(DECRYPT_PENDING_KEY) ?? "{}") as Record<string, boolean>;
    existing[paymentId] = true;
    localStorage.setItem(DECRYPT_PENDING_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }
}

/** Remove from decrypt-pending once oracle has responded */
export function clearDecryptPending(paymentId: string): void {
  try {
    const existing = JSON.parse(localStorage.getItem(DECRYPT_PENDING_KEY) ?? "{}") as Record<string, boolean>;
    delete existing[paymentId];
    localStorage.setItem(DECRYPT_PENDING_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }
}

export function loadDecryptPending(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(DECRYPT_PENDING_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}
