import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Modal, SelectField } from "../components/ui";
import { useTaxGroups, type TaxGroup } from "../hooks/useTaxGroups";
import { apiDelete, apiPatch, apiPost, type Settings } from "../lib/api";
import { errorMessage } from "../lib/format";
import { parseMoney } from "../lib/money";
import { taxesLabel, taxWordsFor } from "../lib/taxWords";

type Save = (patch: Partial<Settings> & { currency?: string; timezone?: string }, message?: string) => Promise<void>;

/** Currencies offered first; every ISO currency the browser knows comes after. */
const COMMON_CURRENCIES = ["INR", "AED", "SAR", "QAR", "OMR", "KWD", "BHD", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "MYR", "NPR", "LKR", "BDT", "KES", "NGN", "ZAR"];

function allOf(kind: "currency" | "timeZone", fallback: string[]): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(kind);
  } catch {
    return fallback;
  }
}

function currencyLabel(code: string): string {
  try {
    return `${code} · ${new Intl.DisplayNames(["en"], { type: "currency" }).of(code)}`;
  } catch {
    return code;
  }
}

/** Tax system, the shop's tax words, currency and time zone (owner). */
export function TaxCard({ s, save }: { s: Settings; save: Save }) {
  const words = taxWordsFor(s);
  const [labels, setLabels] = useState({ taxLabel: s.taxLabel, taxNumberLabel: s.taxNumberLabel, itemCodeLabel: s.itemCodeLabel, invoiceTitle: s.invoiceTitle });
  const [switching, setSwitching] = useState<null | "CUSTOM" | "INDIA_GST">(null);
  // Switching to custom: name the tax first, so the starter groups carry the right name.
  const [first, setFirst] = useState({ taxLabel: s.taxLabel === "GST" ? "VAT" : s.taxLabel, taxNumberLabel: s.taxNumberLabel === "GSTIN" ? "Tax number" : s.taxNumberLabel });
  const currencies = [...COMMON_CURRENCIES, ...allOf("currency", []).filter((c) => !COMMON_CURRENCIES.includes(c))];
  const zones = allOf("timeZone", [s.business.timezone]);
  if (!zones.includes(s.business.timezone)) zones.unshift(s.business.timezone);
  const changed = (Object.keys(labels) as (keyof typeof labels)[]).some((k) => labels[k] !== s[k]);

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="m-0 text-lg font-semibold">Tax &amp; currency</h2>
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" checked={s.taxEnabled} onChange={(e) => void save({ taxEnabled: e.target.checked })} className="mt-1 size-[18px] accent-indigo" />
        <span className="flex flex-col">
          <span className="font-medium">Charge {words.tax} on bills</span>
          <span className="text-sm text-muted">Turn on if you're registered for {words.tax}. Bills then show the tax and the heading below.</span>
        </span>
      </label>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-medium">Tax system</legend>
        {(
          [
            ["INDIA_GST", "India GST", "CGST + SGST in your state, IGST across states, HSN codes, GSTIN and place of supply."],
            ["CUSTOM", "Your own taxes (any country)", "VAT, sales tax and so on: make tax groups (one or more taxes each) and pick one per product."],
          ] as const
        ).map(([mode, title, hint]) => (
          <label key={mode} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 ${s.taxMode === mode ? "border-indigo bg-indigo-50" : "border-line"}`}>
            <input type="radio" name="tax-mode" checked={s.taxMode === mode} onChange={() => setSwitching(mode)} className="mt-1 size-[18px] accent-indigo" />
            <span className="flex flex-col">
              <span className="font-medium">{title}</span>
              <span className="text-sm text-muted">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tax name" value={labels.taxLabel} onChange={(e) => setLabels({ ...labels, taxLabel: e.target.value })} hint="e.g. GST, VAT, Sales tax" />
        <Field label="Tax number name" value={labels.taxNumberLabel} onChange={(e) => setLabels({ ...labels, taxNumberLabel: e.target.value })} hint="e.g. GSTIN, TRN, VAT No" />
        <Field label="Item code name" value={labels.itemCodeLabel} onChange={(e) => setLabels({ ...labels, itemCodeLabel: e.target.value })} hint="e.g. HSN, HS code. Empty hides it." />
        <Field label="Receipt heading" value={labels.invoiceTitle} onChange={(e) => setLabels({ ...labels, invoiceTitle: e.target.value })} hint="While tax is on, e.g. TAX INVOICE" />
      </div>
      <Button variant="secondary" className="self-start" disabled={!changed || !labels.taxLabel.trim() || !labels.taxNumberLabel.trim() || !labels.invoiceTitle.trim()} onClick={() => void save({ ...labels }, "Saved. Screens and receipts use the new words.")}>
        Save tax words
      </Button>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Currency" value={s.business.currency} onChange={(e) => void save({ currency: e.target.value }, "Saved. Amounts show in the new currency; bills keep their numbers.")}>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {currencyLabel(c)}
            </option>
          ))}
        </SelectField>
        <SelectField label="Time zone" value={s.business.timezone} onChange={(e) => void save({ timezone: e.target.value })} hint="Days in reports start at midnight here.">
          {zones.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </SelectField>
      </div>

      {switching ? (
        <Modal title={switching === "CUSTOM" ? "Use your own taxes?" : "Go back to India GST?"} onClose={() => setSwitching(null)}>
          <div className="flex flex-col gap-4">
            {switching === "CUSTOM" ? (
              <>
                <p className="m-0">
                  New bills use tax groups instead of CGST/SGST/IGST. The first time, a group is made for each GST rate your products use, so billing carries on as before. Change the names and rates in Tax groups. Bills already made keep their taxes.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="What is your tax called?" value={first.taxLabel} onChange={(e) => setFirst({ ...first, taxLabel: e.target.value })} hint="e.g. VAT, Sales tax" />
                  <Field label="And your tax number?" value={first.taxNumberLabel} onChange={(e) => setFirst({ ...first, taxNumberLabel: e.target.value })} hint="e.g. TRN, VAT No" />
                </div>
              </>
            ) : (
              <p className="m-0">New bills use each product's GST rate with CGST/SGST or IGST again. Your tax groups are kept for later. Bills already made keep their taxes.</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={switching === "CUSTOM" && (!first.taxLabel.trim() || !first.taxNumberLabel.trim())}
                onClick={() => {
                  const mode = switching;
                  setSwitching(null);
                  void save(
                    mode === "CUSTOM" ? { taxMode: mode, taxLabel: first.taxLabel.trim(), taxNumberLabel: first.taxNumberLabel.trim(), ...(s.itemCodeLabel === "HSN" ? { itemCodeLabel: "HS code" } : {}) } : { taxMode: mode, taxLabel: "GST", taxNumberLabel: "GSTIN", itemCodeLabel: "HSN" },
                    mode === "CUSTOM" ? "Saved. New bills use your tax groups." : "Saved. New bills use India GST.",
                  );
                }}
              >
                {switching === "CUSTOM" ? "Use my own taxes" : "Use India GST"}
              </Button>
              <Button variant="secondary" onClick={() => setSwitching(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </Card>
  );
}

type Row = { key: string; name: string; rate: string };
const newRow = (name = "", rate = ""): Row => ({ key: crypto.randomUUID(), name, rate });

/** Tax groups: what each product pays in custom tax mode (owner). */
export function TaxGroupsCard({ s }: { s: Settings }) {
  const words = taxWordsFor(s);
  const { groups, reload } = useTaxGroups(true);
  const [editing, setEditing] = useState<null | { group: TaxGroup | null }>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card className="flex flex-col gap-3 xl:col-span-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 text-lg font-semibold">Tax groups</h2>
        <Button variant="secondary" className="ml-auto" onClick={() => setEditing({ group: null })}>
          Add tax group
        </Button>
      </div>
      <p className="m-0 text-sm text-muted">Each product pays the taxes of its group; products with no group pay the default group's. Every tax is worked out on the price before tax. Changing a group changes new bills only.</p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {!groups.length ? <Alert tone="warn">No tax groups yet: bills have no tax. Add one, e.g. "Standard" with {words.tax} 5%.</Alert> : null}
      {groups.map((g) => (
        <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2">
          <span className="flex min-w-0 flex-col">
            <span className="font-medium">
              {g.name} {g.isDefault ? <Badge tone="info">Default</Badge> : null}
            </span>
            <span className="text-sm text-muted">
              {taxesLabel(g.taxes)} · {g.products} product{g.products === 1 ? "" : "s"}
            </span>
          </span>
          <span className="ml-auto flex flex-wrap gap-1">
            {!g.isDefault ? (
              <Button variant="ghost" onClick={() => void act(() => apiPatch(`/tax-groups/${g.id}`, { isDefault: true }))}>
                Make default
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setEditing({ group: g })}>
              Edit
            </Button>
            {!g.isDefault ? (
              <Button variant="ghost" onClick={() => window.confirm(`Remove ${g.name}? Its products will pay the default group's taxes.`) && void act(() => apiDelete(`/tax-groups/${g.id}`))}>
                Remove
              </Button>
            ) : null}
          </span>
        </div>
      ))}
      {editing ? (
        <GroupDialog
          group={editing.group}
          taxLabel={words.tax}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </Card>
  );
}

function GroupDialog({ group, taxLabel, onClose, onSaved }: { group: TaxGroup | null; taxLabel: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(group?.name ?? "");
  const [rows, setRows] = useState<Row[]>(group ? group.taxes.map((t) => newRow(t.name, String(t.rateBp / 100))) : [newRow(taxLabel, "")]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = rows.map((r) => ({ name: r.name.trim(), rateBp: parseMoney(r.rate) }));
  const bad = parsed.some((t) => !t.name || t.rateBp === null || t.rateBp > 10_000);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), taxes: parsed.map((t) => ({ name: t.name, rateBp: t.rateBp! })) };
      if (group) await apiPatch(`/tax-groups/${group.id}`, body);
      else await apiPost("/tax-groups", body);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={group ? `Edit ${group.name}` : "New tax group"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Group name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard, Food, Hotel" autoFocus />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Taxes in this group</span>
          {rows.map((r, i) => (
            <div key={r.key} className="flex items-end gap-2">
              <Field label={`Tax ${i + 1} name`} value={r.name} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, name: e.target.value } : x)))} className="flex-1" />
              <Field
                label="Rate %"
                inputMode="decimal"
                value={r.rate}
                onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, rate: e.target.value } : x)))}
                error={r.rate && (parseMoney(r.rate) === null || parseMoney(r.rate)! > 10_000) ? "0 to 100." : undefined}
                className="w-24"
              />
              <button type="button" aria-label={`Remove tax ${i + 1}`} onClick={() => setRows(rows.filter((x) => x.key !== r.key))} className="mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:text-[#A3361F]">
                ✕
              </button>
            </div>
          ))}
          {rows.length < 5 ? (
            <button type="button" onClick={() => setRows([...rows, newRow()])} className="min-h-9 self-start text-sm font-semibold text-indigo">
              + Add a tax
            </button>
          ) : null}
          <span className="text-xs text-muted">No taxes = exempt. Each tax is a % of the price before tax.</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button busy={busy} disabled={!name.trim() || bad} onClick={() => void submit()}>
            Save group
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
