import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Field, PageHeader, SelectField } from "../components/ui";
import { apiGet, apiPatch, apiPost, type PaymentMethod, type Settings } from "../lib/api";
import { setSettings } from "../hooks/useSettings";
import { errorMessage } from "../lib/format";
import { bpToPercent, parseMoney } from "../lib/money";
import { looksLikeUpiId } from "../lib/payments";
import { SettingsTabs } from "./SettingsTabs";

export function PosSettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [cap, setCap] = useState("");
  const [footer, setFooter] = useState("");
  const [upiId, setUpiId] = useState("");
  const [newMethod, setNewMethod] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    Promise.all([apiGet<Settings>("/settings"), apiGet<{ methods: PaymentMethod[] }>("/payment-methods")]).then(([settings, m]) => {
      setS(settings);
      setCap(bpToPercent(settings.cashierMaxDiscountBp));
      setFooter(settings.receiptFooter);
      setUpiId(settings.upiId);
      setMethods(m.methods);
    }, (err: unknown) => setError(errorMessage(err)));
  useEffect(() => {
    void load();
  }, []);

  async function save(patch: Partial<Settings>, message = "Saved.") {
    const before = s;
    setError(null);
    setNotice(null);
    // Show the change at once; put it back if the server refuses.
    setS((cur) => (cur ? { ...cur, ...patch } : cur));
    try {
      const saved = await apiPatch<Settings>("/settings", patch);
      setS(saved);
      setSettings(saved);
      setNotice(message);
    } catch (err) {
      setS(before);
      setError(errorMessage(err));
    }
  }

  if (!s) return <div className="w-full">{error ? <Alert tone="error">{error}</Alert> : <p className="text-muted">Loading…</p>}</div>;
  const capBp = parseMoney(cap);
  const upiBad = upiId.trim() !== "" && !looksLikeUpiId(upiId);

  return (
    <div className="w-full">
      <PageHeader title="Settings" description="Only the owner sees this page." />
      <SettingsTabs />
      {notice ? <div className="mb-4"><Alert tone="ok">{notice}</Alert></div> : null}
      {error ? <div className="mb-4"><Alert tone="error">{error}</Alert></div> : null}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <h2 className="m-0 text-lg font-semibold">Billing</h2>
          <label className="flex min-h-11 items-start gap-3">
            <input type="checkbox" checked={s.taxEnabled} onChange={(e) => void save({ taxEnabled: e.target.checked })} className="mt-1 size-[18px] accent-indigo" />
            <span className="flex flex-col">
              <span className="font-medium">Charge GST on bills</span>
              <span className="text-sm text-muted">Turn on if you're GST-registered. Bills then show HSN, CGST/SGST or IGST and say "Tax invoice".</span>
            </span>
          </label>
          <label className="flex min-h-11 items-start gap-3">
            <input type="checkbox" checked={s.allowNegativeStock} onChange={(e) => void save({ allowNegativeStock: e.target.checked })} className="mt-1 size-[18px] accent-indigo" />
            <span className="flex flex-col">
              <span className="font-medium">Allow selling when stock is zero</span>
              <span className="text-sm text-muted">Stock can go below zero and is flagged. Turn off to block bills for items you don't have.</span>
            </span>
          </label>
          <label className="flex min-h-11 items-start gap-3">
            <input type="checkbox" checked={s.batchTracking} onChange={(e) => void save({ batchTracking: e.target.checked }, e.target.checked ? "Batch tracking is on. Current stock is now an opening batch for each product." : "Saved.")} className="mt-1 size-[18px] accent-indigo" />
            <span className="flex flex-col">
              <span className="font-medium">Batch & expiry tracking</span>
              <span className="text-sm text-muted">For medicines and packaged goods. Stock is kept in batches with batch no., expiry and cost; bills take the earliest expiry first and print batch and expiry.</span>
            </span>
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Largest discount a cashier can give (%)" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} error={cap && (capBp === null || capBp > 10000) ? "0 to 100." : undefined} className="flex-[1_1_240px]" />
            <Button variant="secondary" disabled={capBp === null || capBp > 10000} onClick={() => save({ cashierMaxDiscountBp: capBp! })}>
              Save
            </Button>
          </div>
        </Card>
        <Card className="flex flex-col gap-4">
          <h2 className="m-0 text-lg font-semibold">Receipt</h2>
          <SelectField label="Paper" value={s.receiptPaperSize} onChange={(e) => void save({ receiptPaperSize: e.target.value as Settings["receiptPaperSize"] })}>
            <option value="80mm">80 mm thermal</option>
            <option value="58mm">58 mm thermal</option>
            <option value="a4">A4</option>
          </SelectField>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Footer line" value={footer} onChange={(e) => setFooter(e.target.value)} className="flex-[1_1_240px]" />
            <Button variant="secondary" onClick={() => save({ receiptFooter: footer })}>
              Save
            </Button>
          </div>
        </Card>
        <Card className="flex flex-col gap-4">
          <h2 className="m-0 text-lg font-semibold">UPI QR</h2>
          <p className="m-0 text-sm text-muted">With your UPI ID, billing shows a QR for the exact amount when the customer pays by UPI, or for the UPI part of a split bill.</p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Shop's UPI ID" placeholder="e.g. shopname@okaxis" autoCapitalize="none" spellCheck={false} value={upiId} onChange={(e) => setUpiId(e.target.value)} error={upiBad ? "Enter a UPI ID like shopname@okaxis." : undefined} className="flex-[1_1_240px]" />
            <Button variant="secondary" disabled={upiBad || upiId.trim() === s.upiId} onClick={() => save({ upiId: upiId.trim() }, upiId.trim() ? "Saved. Billing shows a UPI QR for the amount." : "Saved. Billing won't show a UPI QR.")}>
              Save
            </Button>
          </div>
          <label className="flex min-h-11 items-start gap-3">
            <input type="checkbox" checked={s.printUpiQrOnReceipt} disabled={!s.upiId} onChange={(e) => void save({ printUpiQrOnReceipt: e.target.checked })} className="mt-1 size-[18px] accent-indigo" />
            <span className="flex flex-col">
              <span className="font-medium">Print a UPI QR on receipts</span>
              <span className="text-sm text-muted">For the amount paid by UPI (the UPI part of a split bill) or left on udhaar, so the customer can pay later. Bills paid fully in cash or card don't get one. The cashier can switch it off for a receipt.{!s.upiId ? " Save your UPI ID first." : ""}</span>
            </span>
          </label>
        </Card>
        <Card className="flex flex-col gap-3 xl:col-span-2">
          <h2 className="m-0 text-lg font-semibold">Payment methods</h2>
          {methods.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2">
              <span className="font-medium">{m.name}</span>
              <Badge tone="muted">{m.kind === "CREDIT" ? "Udhaar" : m.kind}</Badge>
              {!m.active ? <Badge tone="warn">Hidden at billing</Badge> : null}
              <Button
                variant="ghost"
                className="ml-auto"
                onClick={async () => {
                  await apiPatch(`/payment-methods/${m.id}`, { active: !m.active });
                  void load();
                }}
              >
                {m.active ? "Hide" : "Show"}
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Add a method" placeholder="e.g. Paytm, Cheque" value={newMethod} onChange={(e) => setNewMethod(e.target.value)} className="flex-[1_1_240px]" />
            <Button
              variant="secondary"
              disabled={!newMethod.trim()}
              onClick={async () => {
                await apiPost("/payment-methods", { name: newMethod.trim(), kind: "OTHER", sort: methods.length + 1 });
                setNewMethod("");
                void load();
              }}
            >
              Add
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
