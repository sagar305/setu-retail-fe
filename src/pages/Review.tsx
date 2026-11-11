import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, PageHeader } from "../components/ui";
import { apiGet, apiPost, type Schemas } from "../lib/api";
import { formatMoney } from "../lib/money";
import { errorMessage } from "../lib/format";

type Conflict = Schemas["Conflict"];

const ENTITY: Record<string, string> = { product: "Product", branch_price: "Branch price", customer: "Customer", supplier: "Supplier" };
const FIELD: Record<string, string> = {
  price: "Price",
  costPrice: "Cost price",
  name: "Name",
  phone: "Phone",
  email: "Email",
  gstRateBp: "Tax rate",
  taxGroupId: "Tax group",
  hsn: "Item code",
  sku: "SKU",
  barcode: "Barcode",
  unit: "Unit",
  address: "Address",
  notes: "Notes",
  creditDays: "Credit days",
  gstin: "Tax number",
  lowStockMilli: "Low stock at",
  taxInclusive: "Price includes tax",
  trackStock: "Track stock",
};
const MONEY = new Set(["price", "costPrice"]);

/** How a stored value reads, e.g. ₹120.00, 5%, "Yes". */
function show(field: string | null, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (field && MONEY.has(field) && typeof v === "number") return formatMoney(v);
  if (field === "gstRateBp" && typeof v === "number") return `${v / 100}%`;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

/** The owner's "Needs review" list (decision v1.9). */
export function ReviewPage() {
  const [items, setItems] = useState<Conflict[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<{ conflicts: Conflict[] }>("/conflicts").then((r) => setItems(r.conflicts), (e: unknown) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  async function resolve(c: Conflict, choice: string) {
    setBusy(c.id + choice);
    setError(null);
    try {
      await apiPost(`/conflicts/${c.id}/resolve`, { choice });
      setItems((xs) => (xs ?? []).filter((x) => x.id !== c.id));
      window.dispatchEvent(new Event("setu:review"));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-full max-w-3xl">
      <PageHeader title="Needs review" description="Changes made on two devices at once, while one of them was offline. Until you pick, the cloud keeps its value." />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {items && !items.length ? <Alert tone="ok">Nothing to review. Changes from every device fitted together.</Alert> : null}
      {!items && !error ? <p className="text-muted">Loading…</p> : null}
      <div className="flex flex-col gap-3">
        {(items ?? []).map((c) => (
          <Card key={c.id}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone="muted">{ENTITY[c.entityType] ?? c.entityType}</Badge>
              <strong className="[overflow-wrap:anywhere]">{c.label}</strong>
            </div>
            {c.kind === "field" ? (
              <>
                <p className="m-0 mb-3 text-sm text-muted">
                  {FIELD[c.field ?? ""] ?? c.field} was changed on two devices. {c.userName || "Someone"} set it on a device on {when(c.changedAt)}, but it had already been changed in the cloud.
                </p>
                <dl className="m-0 mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted">Was</dt>
                  <dd className="m-0">{show(c.field, c.baseValue)}</dd>
                  <dt className="text-muted">Cloud now</dt>
                  <dd className="m-0 font-semibold">{show(c.field, c.cloudValue)}</dd>
                  <dt className="text-muted">From the device</dt>
                  <dd className="m-0 font-semibold">{show(c.field, c.deviceValue)}</dd>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" busy={busy === c.id + "cloud"} onClick={() => void resolve(c, "cloud")}>
                    Keep {show(c.field, c.cloudValue)}
                  </Button>
                  <Button busy={busy === c.id + "device"} onClick={() => void resolve(c, "device")}>
                    Use {show(c.field, c.deviceValue)}
                  </Button>
                </div>
              </>
            ) : c.kind === "removed" ? (
              <>
                <p className="m-0 mb-4 text-sm text-muted">
                  {c.userName || "Someone"} edited this on a device on {when(c.changedAt)}, but it had been removed meanwhile.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" busy={busy === c.id + "discard"} onClick={() => void resolve(c, "discard")}>
                    Keep it removed
                  </Button>
                  <Button busy={busy === c.id + "restore"} onClick={() => void resolve(c, "restore")}>
                    Bring it back with the edit
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="m-0 mb-4 text-sm text-muted">
                  Two customers have the same phone number, probably added at two counters. Merging moves the newer one's bills and udhaar to the older one.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" busy={busy === c.id + "keep_both"} onClick={() => void resolve(c, "keep_both")}>
                    They're different people
                  </Button>
                  <Button busy={busy === c.id + "merge"} onClick={() => void resolve(c, "merge")}>
                    Merge into one
                  </Button>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
