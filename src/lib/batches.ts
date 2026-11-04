import { useEffect, useState } from "react";
import { apiGet, type Batch } from "./api";

export const EXPIRY_TONE = { expired: "error", soon: "warn", ok: "muted", none: "muted" } as const;
export const expiryLabel = (b: Pick<Batch, "expiry" | "status" | "opening">) =>
  b.opening ? "No batch details" : !b.expiry ? "No expiry" : b.status === "expired" ? `Expired ${fmtDay(b.expiry)}` : `Exp ${fmtDay(b.expiry)}`;
export const fmtDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function useBatches(productId: string, branchId: string) {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    apiGet<{ batches: Batch[] }>(`/products/${productId}/batches?branchId=${branchId}`).then((r) => alive && setBatches(r.batches), () => alive && setBatches([]));
    return () => {
      alive = false;
    };
  }, [productId, branchId, version]);
  return { batches, reload: () => setVersion((v) => v + 1) };
}

