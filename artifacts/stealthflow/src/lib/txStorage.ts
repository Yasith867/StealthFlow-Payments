const TX_MAP_KEY = "stealthflow_txmap";

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
