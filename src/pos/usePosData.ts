import { useCallback, useEffect, useState } from "react";
import { apiGet, type Category, type PaymentMethod, type Product, type Settings } from "../lib/api";
import { errorMessage } from "../lib/format";

export type PosData = { settings: Settings; methods: PaymentMethod[]; products: Product[]; categories: Category[] };

async function fetchPosData(branchId: string): Promise<PosData> {
  const [settings, m, p, c] = await Promise.all([
    apiGet<Settings>("/settings"),
    apiGet<{ methods: PaymentMethod[] }>("/payment-methods"),
    apiGet<{ products: Product[] }>(`/products?branchId=${branchId}&limit=2000`),
    apiGet<{ categories: Category[] }>("/categories"),
  ]);
  return { settings, methods: m.methods.filter((x) => x.active), products: p.products, categories: c.categories };
}

/** Everything the counter needs for one branch; `reload()` refetches (e.g. stock after a sale). */
export function usePosData(branchId: string | null) {
  const [data, setData] = useState<PosData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!branchId) return;
    let alive = true;
    fetchPosData(branchId).then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      },
      (err: unknown) => alive && setError(errorMessage(err)),
    );
    return () => {
      alive = false;
    };
  }, [branchId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, reload };
}
