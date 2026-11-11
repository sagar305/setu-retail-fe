import { useCallback, useEffect, useMemo, useState } from "react";
import { taxWordsFor } from "../../lib/taxWords";
import { useMe } from "../../auth/AuthProvider";
import { Alert, Badge, Button, Card, Field, PageHeader, SelectField } from "../../components/ui";
import { setSettings, useSettings, useTaxWords } from "../../hooks/useSettings";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, type Order, type ReceiptTemplate, type Settings } from "../../lib/api";
import { computeBill } from "../../lib/gst";
import { errorMessage } from "../../lib/format";
import { Receipt } from "../../pos/Receipt";

type Draft = Omit<ReceiptTemplate, "id" | "isDefault">;
const BLANK: Draft = { name: "New design", paperSize: "80mm", accentColor: "#26306B", headerText: "", footerText: "", showLogo: false, showBusinessInfo: true, showGstin: true, showHsn: true, showGstSummary: true, showAmountWords: true, boldTotals: true, separator: "dashed" };
const TOGGLES: { key: keyof Draft; label: string }[] = [
  { key: "showLogo", label: "Logo" },
  { key: "showBusinessInfo", label: "Branch name, address and phone" },
  { key: "showGstin", label: "GSTIN" },
  { key: "showHsn", label: "HSN codes on items" },
  { key: "showGstSummary", label: "GST summary by rate" },
  { key: "showAmountWords", label: "Amount in words" },
  { key: "boldTotals", label: "Bold total" },
];

/** A made-up bill to preview designs with. */
function sampleOrder(settings: Settings, branch: { id: string; code: string; name: string; address: string; phone: string; gstin: string | null; stateCode: string | null }): Order {
  const lines = [
    { name: "Wheat Atta 5 kg", hsn: "1101", unit: "pcs", unitPrice: 28500, qtyMilli: 1000, gstRateBp: 500, taxInclusive: true },
    { name: "Tea 250 g", hsn: "0902", unit: "pcs", unitPrice: 14500, qtyMilli: 2000, gstRateBp: 500, taxInclusive: true },
    { name: "Detergent 1 kg", hsn: "3402", unit: "pcs", unitPrice: 12000, qtyMilli: 1000, gstRateBp: 1800, taxInclusive: true },
  ];
  // Custom tax mode: the sample shows one tax at each line's rate, by the shop's tax name.
  const custom = settings.taxMode === "CUSTOM";
  const label = taxWordsFor(settings).tax;
  const bill = computeBill(
    lines.map((l) => (custom ? { ...l, taxes: [{ name: label, rateBp: l.gstRateBp }] } : l)),
    { type: "flat", value: 0 },
    { taxEnabled: settings.taxEnabled, interState: false },
  );
  return {
    id: "sample",
    invoiceNumber: `${branch.code}-C1-00042`,
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
    branch,
    counter: { code: "C1", name: "Counter 1" },
    cashierId: "sample",
    cashierName: "Ravi",
    customer: null,
    placeOfSupply: custom ? null : branch.stateCode,
    interState: false,
    taxEnabled: settings.taxEnabled,
    taxMode: settings.taxMode,
    taxTotals: bill.taxTotals,
    discount: { type: "flat", value: 0 },
    subtotal: bill.subtotal,
    discountTotal: 0,
    taxableTotal: bill.taxableTotal,
    cgstTotal: bill.cgstTotal,
    sgstTotal: bill.sgstTotal,
    igstTotal: bill.igstTotal,
    total: bill.total,
    returnedTotal: 0,
    note: "",
    cancelledAt: null,
    cancelReason: "",
    offline: false,
    priceDiffers: false,
    items: bill.lines.map((l, i) => ({ id: `s${i}`, productId: null, name: lines[i]!.name, hsn: lines[i]!.hsn, unit: "pcs", qtyMilli: l.qtyMilli, unitPrice: l.unitPrice, gstRateBp: l.gstRateBp, taxInclusive: true, gross: l.gross, discount: 0, taxable: l.taxable, cgst: l.cgst, sgst: l.sgst, igst: l.igst, taxes: l.taxes, total: l.total, returnedQtyMilli: 0, batches: [] })),
    payments: [{ methodId: "s", methodName: "UPI", kind: "UPI", amount: bill.total }],
    creditNotes: [],
  } as Order;
}

/** Shrink a picked image to a small PNG for receipts. */
async function toLogo(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 320 / img.width, 160 / img.height);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

/** Receipt Designer: saved designs, the default, and which branch prints which. */
export function ReceiptDesignerPage() {
  const me = useMe();
  const settings = useSettings();
  const words = useTaxWords();
  const isOwner = me.user.role === "OWNER";
  const [templates, setTemplates] = useState<ReceiptTemplate[] | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [branchChoice, setBranchChoice] = useState<Record<string, string | null>>(() => Object.fromEntries(me.branches.map((b) => [b.id, b.receiptTemplateId])));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGet<{ templates: ReceiptTemplate[] }>("/receipt-templates").then((r) => setTemplates(r.templates), (e: unknown) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const branch = me.branches[0]!;
  const sample = useMemo(() => (settings ? sampleOrder(settings, branch) : null), [settings, branch]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, [k]: v } } : e));

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      if (editing.id) await apiPatch(`/receipt-templates/${editing.id}`, editing.draft);
      else await apiPost("/receipt-templates", editing.draft);
      setNotice(`Saved “${editing.draft.name}”.`);
      setEditing(null);
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function act(fn: () => Promise<unknown>, message: string) {
    setError(null);
    try {
      await fn();
      setNotice(message);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Receipt Designer"
        description="Design how receipts look. Billing prints with the branch's design, else the default; the cashier can switch before printing."
        actions={
          editing ? null : (
            <Button onClick={() => setEditing({ id: null, draft: { ...BLANK, paperSize: settings?.receiptPaperSize ?? "80mm", footerText: settings?.receiptFooter ?? "" } })}>New design</Button>
          )
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {editing && settings && sample ? (
        <div className="flex flex-wrap items-start gap-5">
          <Card className="flex-[1_1_360px]">
            <div className="flex flex-col gap-4">
              <Field label="Design name" value={editing.draft.name} onChange={(e) => set("name", e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Paper" value={editing.draft.paperSize} onChange={(e) => set("paperSize", e.target.value as Draft["paperSize"])}>
                  <option value="80mm">80 mm thermal</option>
                  <option value="58mm">58 mm thermal</option>
                  <option value="a4">A4</option>
                </SelectField>
                <SelectField label="Lines between parts" value={editing.draft.separator} onChange={(e) => set("separator", e.target.value as Draft["separator"])}>
                  <option value="dashed">Dashed</option>
                  <option value="solid">Solid</option>
                  <option value="none">None</option>
                </SelectField>
              </div>
              <label className="flex items-center gap-3 text-sm font-medium">
                Colour (shop name and title)
                <input type="color" value={editing.draft.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-11 w-16 cursor-pointer rounded-[10px] border border-line-strong bg-white" />
                <span className="text-muted">{editing.draft.accentColor}</span>
              </label>
              <Field label="Header text (optional)" value={editing.draft.headerText} onChange={(e) => set("headerText", e.target.value)} placeholder="e.g. Free home delivery on big orders" />
              <Field label="Footer text" value={editing.draft.footerText} onChange={(e) => set("footerText", e.target.value)} placeholder="Thank you! Visit again." />
              <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
                <legend className="mb-1 text-sm font-medium">Show</legend>
                {TOGGLES.map((t) => (
                  <label key={t.key} className="flex min-h-10 items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(editing.draft[t.key])} onChange={(e) => set(t.key, e.target.checked as never)} className="size-5 accent-indigo" />
                    {t.key === "showGstin" ? words.number : t.key === "showHsn" ? `${words.code || "Item"} codes on items` : t.key === "showGstSummary" ? `${words.tax} summary` : t.label}
                    {t.key === "showLogo" && !settings.logoDataUrl ? <span className="text-xs text-muted">(add a logo below)</span> : null}
                  </label>
                ))}
              </fieldset>
              <div className="flex gap-3">
                <Button busy={busy} disabled={!editing.draft.name.trim()} onClick={() => void save()}>
                  Save design
                </Button>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
          <section aria-label="Preview" className="flex-[1_1_340px] overflow-auto rounded-xl border border-line bg-cream p-3">
            <Receipt order={sample} settings={settings} template={editing.draft} />
          </section>
        </div>
      ) : null}

      {!editing ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {(templates ?? []).map((t) => (
              <Card key={t.id}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="size-4 rounded-full" style={{ background: t.accentColor }} aria-hidden="true" />
                    <strong className="mr-auto">{t.name}</strong>
                    {t.isDefault ? <Badge tone="ok">Default</Badge> : null}
                  </div>
                  <span className="text-sm text-muted">{t.paperSize === "a4" ? "A4" : `${t.paperSize} thermal`}{t.footerText ? ` · “${t.footerText}”` : ""}</span>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setEditing({ id: t.id, draft: { ...t } })}>
                      Edit
                    </Button>
                    {!t.isDefault ? <Button variant="ghost" onClick={() => void act(() => apiPost(`/receipt-templates/${t.id}/default`), `“${t.name}” is now the default.`)}>Make default</Button> : null}
                    <Button variant="ghost" aria-label={`Delete ${t.name}`} onClick={() => window.confirm(`Delete “${t.name}”?`) && void act(() => apiDelete(`/receipt-templates/${t.id}`), "Deleted.")}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {templates && !templates.length ? <p className="m-0 text-muted">No designs yet: receipts print in the classic layout. Make a design to change how they look.</p> : null}
          </div>

          {templates?.length && me.branches.length ? (
            <Card>
              <h2 className="mt-0 mb-3 text-base font-semibold">Which design each branch prints</h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {me.branches.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-3">
                    <span className="min-w-40 font-medium">
                      {b.name} ({b.code})
                    </span>
                    <select
                      aria-label={`Design for ${b.name}`}
                      value={branchChoice[b.id] ?? ""}
                      onChange={(e) => {
                        const templateId = e.target.value || null;
                        setBranchChoice({ ...branchChoice, [b.id]: templateId });
                        void act(() => apiPut(`/receipt-templates/branches/${b.id}`, { templateId }), `${b.name} prints with ${templateId ? (templates.find((t) => t.id === templateId)?.name ?? "it") : "the default"}.`);
                      }}
                      className="h-11 rounded-[10px] border border-line-strong bg-white px-2 text-sm"
                    >
                      <option value="">The default ({templates.find((t) => t.isDefault)?.name ?? "classic"})</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {isOwner ? (
            <Card>
              <h2 className="mt-0 mb-2 text-base font-semibold">Logo</h2>
              <p className="mt-0 mb-3 text-sm text-muted">Shown on designs with “Logo” ticked. Black and white logos print best on thermal paper.</p>
              <div className="flex flex-wrap items-center gap-4">
                {settings?.logoDataUrl ? <img src={settings.logoDataUrl} alt="Shop logo" className="max-h-16 max-w-48 rounded border border-line bg-white p-1" /> : <span className="text-sm text-muted">No logo yet.</span>}
                <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border border-indigo bg-white px-4 text-sm font-semibold text-indigo">
                  {settings?.logoDataUrl ? "Change logo" : "Add logo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        setSettings(await apiPatch<Settings>("/settings", { logoDataUrl: await toLogo(f) }));
                        setNotice("Logo saved.");
                      } catch (err) {
                        setError(errorMessage(err));
                      }
                    }}
                  />
                </label>
                {settings?.logoDataUrl ? (
                  <Button variant="ghost" onClick={async () => setSettings(await apiPatch<Settings>("/settings", { logoDataUrl: null }))}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
