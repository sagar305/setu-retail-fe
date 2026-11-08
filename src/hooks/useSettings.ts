import { useEffect, useSyncExternalStore } from "react";
import { apiGet, type Settings } from "../lib/api";
import { setMoneyCurrency } from "../lib/money";
import { taxWordsFor, type TaxWords } from "../lib/taxWords";

// One copy of the POS settings for the signed-in app (tools on/off, tax, etc.),
// refreshed after the owner saves them.
let current: Settings | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setSettings(s: Settings | null) {
  current = s;
  // Amounts everywhere show in the shop's currency.
  setMoneyCurrency(s?.business.currency);
  emit();
}

export function reloadSettings(): Promise<void> {
  loading ??= apiGet<Settings>("/settings")
    .then(setSettings, () => {})
    .finally(() => {
      loading = null;
    });
  return loading;
}

export function useSettings(): Settings | null {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
  useEffect(() => {
    if (!current) void reloadSettings();
  }, []);
  return s;
}

/** The shop's tax words (GST/VAT…, GSTIN/TRN…), from the settings. */
export function useTaxWords(): TaxWords {
  return taxWordsFor(useSettings());
}
