import { useCallback, useEffect, useState } from "react";
import { apiGet, type Schemas } from "../lib/api";
import { useCacheRefresh } from "./useCacheRefresh";

export type TaxGroup = Schemas["TaxGroup"];

/** The shop's tax groups (custom tax mode); [] in India GST mode or until loaded. */
export function useTaxGroups(enabled = true): { groups: TaxGroup[]; reload: () => void } {
  const [groups, setGroups] = useState<TaxGroup[]>([]);
  const reload = useCallback(() => {
    if (!enabled) return;
    apiGet<{ groups: TaxGroup[] }>("/tax-groups").then((r) => setGroups(r.groups), () => {});
  }, [enabled]);
  useEffect(reload, [reload]);
  useCacheRefresh(["/tax-groups"], reload);
  return { groups, reload };
}
