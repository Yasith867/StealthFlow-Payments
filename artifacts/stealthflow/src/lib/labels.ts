export const LABELS: Record<string, string> = {};

// Load all labels (temporary stub)
export function loadAllLabels() {
  return LABELS;
}

// Promote label (temporary stub)
export function promotePendingLabel(key: string, value?: string) {
  LABELS[key] = value ?? key;
}
