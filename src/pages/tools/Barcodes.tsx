import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { BranchSelect } from "../../components/BranchSelect";
import { Alert, Button, Card, Field, PageHeader, SelectField } from "../../components/ui";
import { useBranchChoice } from "../../hooks/useBranchChoice";
import { apiGet, apiPost, type Product } from "../../lib/api";
import { errorMessage } from "../../lib/format";
import { formatMoney } from "../../lib/money";
import { kindFor, type BarcodeKind as Kind } from "../../lib/barcodes";

type Layout = "a4-65" | "a4-40" | "roll-50x25" | "roll-38x25";
const LAYOUTS: Record<Layout, { label: string; page: string; cols: number; rows: number; w: number; h: number; padTop: number; padLeft: number; gapX: number }> = {
  "a4-65": { label: "A4 sheet · 65 labels (38 × 21 mm)", page: "A4", cols: 5, rows: 13, w: 38.1, h: 21.2, padTop: 10.7, padLeft: 4.7, gapX: 2.5 },
  "a4-40": { label: "A4 sheet · 40 labels (52 × 30 mm)", page: "A4", cols: 4, rows: 10, w: 52.5, h: 29.7, padTop: 0, padLeft: 0, gapX: 0 },
  "roll-50x25": { label: "Label printer roll · 50 × 25 mm", page: "50mm 25mm", cols: 1, rows: 1, w: 50, h: 25, padTop: 0, padLeft: 0, gapX: 0 },
  "roll-38x25": { label: "Label printer roll · 38 × 25 mm", page: "38mm 25mm", cols: 1, rows: 1, w: 38, h: 25, padTop: 0, padLeft: 0, gapX: 0 },
};

function Barcode({ value, kind, height, fontSize }: { value: string; kind: Kind; height: number; fontSize: number }) {
  const [qr, setQr] = useState<{ value: string; url: string | null } | null>(null);
  // Bar codes are drawn once into SVG markup; null when the value can't be encoded.
  const markup = useMemo(() => {
    if (kind === "QR") return null;
    try {
      const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(el, value, { format: kind, height, width: 1.4, fontSize, margin: 0, textMargin: 0, displayValue: true });
      el.setAttribute("class", "h-auto max-h-[62%] w-full");
      el.setAttribute("preserveAspectRatio", "xMidYMid meet");
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", `Barcode ${value}`);
      return el.outerHTML;
    } catch {
      return null;
    }
  }, [value, kind, height, fontSize]);
  useEffect(() => {
    if (kind !== "QR") return;
    let alive = true;
    QRCode.toDataURL(value, { margin: 0, width: 240 }).then(
      (url) => alive && setQr({ value, url }),
      () => alive && setQr({ value, url: null }),
    );
    return () => {
      alive = false;
    };
  }, [value, kind]);
  if (kind === "QR") {
    if (!qr || qr.value !== value) return null;
    return qr.url ? <img src={qr.url} alt={`QR ${value}`} className="h-full max-h-[60%] w-auto" /> : <span className="text-[8px] text-[#A3361F]">Can't make a QR code from that.</span>;
  }
  if (!markup) return <span className="text-[8px] text-[#A3361F]">Can't make a {kind === "EAN13" ? "EAN-13" : "Code 128"} barcode from “{value}”</span>;
  return <span className="flex w-full justify-center" dangerouslySetInnerHTML={{ __html: markup }} />;
}

type Label = { key: string; code: string; name: string; price: string; kind?: Kind };

function Sheet({ labels, layout, showName, showPrice }: { labels: Label[]; layout: Layout; showName: boolean; showPrice: boolean }) {
  const L = LAYOUTS[layout];
  const perPage = L.cols * L.rows;
  const pages = Array.from({ length: Math.max(1, Math.ceil(labels.length / perPage)) }, (_, i) => labels.slice(i * perPage, (i + 1) * perPage));
  const a4 = L.page === "A4";
  return (
    <>
      {pages.map((page, p) => (
        <div key={p} className="label-page bg-white text-black" style={{ width: a4 ? "210mm" : `${L.w}mm`, height: a4 ? "297mm" : `${L.h}mm`, paddingTop: `${L.padTop}mm`, paddingLeft: `${L.padLeft}mm`, boxSizing: "border-box", display: "grid", gridTemplateColumns: `repeat(${L.cols}, ${L.w}mm)`, gridAutoRows: `${L.h}mm`, columnGap: `${L.gapX}mm`, breakAfter: "page", overflow: "hidden" }}>
          {page.map((l) => (
            <div key={l.key} className="flex flex-col items-center justify-center overflow-hidden px-[1.5mm] text-center leading-tight" style={{ width: `${L.w}mm`, height: `${L.h}mm`, boxSizing: "border-box" }}>
              {showName ? <span className="w-full truncate text-[7pt] font-semibold">{l.name}</span> : null}
              <Barcode value={l.code} kind={l.kind ?? kindFor(l.code)} height={L.h > 24 ? 34 : 26} fontSize={10} />
              {showPrice ? <span className="text-[8pt] font-bold">{l.price}</span> : null}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

/** Barcode Generator: label sheets, label rolls, single labels, and in-store barcodes. */
export function BarcodesPage() {
  const [branch, setBranch] = useBranchChoice();
  const [products, setProducts] = useState<Product[]>([]);
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [layout, setLayout] = useState<Layout>("a4-65");
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState<null | "sheet" | "single">(null);
  const [single, setSingle] = useState({ kind: "CODE128" as Kind, value: "", label: "" });

  useEffect(() => {
    if (branch) apiGet<{ products: Product[] }>(`/products?branchId=${branch.id}&limit=2000`).then((r) => setProducts(r.products), (e: unknown) => setError(errorMessage(e)));
  }, [branch]);

  const chosen = products.filter((p) => (copies[p.id] ?? 0) > 0);
  const missing = chosen.filter((p) => !p.barcode && !p.sku);
  const labels: Label[] = chosen.flatMap((p) => Array.from({ length: copies[p.id]! }, (_, i) => ({ key: `${p.id}-${i}`, code: p.barcode || p.sku, name: p.name, price: formatMoney(p.price) }))).filter((l) => l.code);
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => !t || p.name.toLowerCase().includes(t) || p.sku.toLowerCase() === t || p.barcode === q.trim());
  }, [products, q]);

  // Only the labels print, on the label's own page size.
  useEffect(() => {
    if (!printing) return;
    const size = printing === "single" ? "50mm 25mm" : LAYOUTS[layout].page;
    const style = document.createElement("style");
    style.textContent = `@media print { @page { size: ${size}; margin: 0 } .print-area { position: static !important } }`;
    document.head.appendChild(style);
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done);
    const t = window.setTimeout(() => window.print(), 300);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
      style.remove();
    };
  }, [printing, layout]);

  async function makeBarcodes() {
    setBusy(true);
    setError(null);
    try {
      const r = await apiPost<{ generated: { productId: string; barcode: string }[] }>("/products/barcodes", { productIds: chosen.filter((p) => !p.barcode).map((p) => p.id) });
      const by = new Map(r.generated.map((g) => [g.productId, g.barcode]));
      setProducts((ps) => ps.map((p) => (by.has(p.id) ? { ...p, barcode: by.get(p.id)! } : p)));
      setNotice(`Made ${r.generated.length} barcode${r.generated.length === 1 ? "" : "s"} and saved them to the products. The scanner finds them at billing.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function downloadSingle() {
    const canvas = document.createElement("canvas");
    try {
      if (single.kind === "QR") await QRCode.toCanvas(canvas, single.value, { width: 400, margin: 2 });
      else JsBarcode(canvas, single.value, { format: single.kind, height: 90, margin: 12, text: single.label ? `${single.label} · ${single.value}` : undefined });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `barcode-${single.value.replace(/\W+/g, "_")}.png`;
      a.click();
    } catch {
      setError(`Can't make a ${single.kind === "EAN13" ? "EAN-13 (12 or 13 digits)" : single.kind} barcode from that.`);
    }
  }

  if (!branch) return <Alert tone="warn">No branch is active for you.</Alert>;
  return (
    <div className="w-full">
      <PageHeader title="Barcode Generator" description="Print scannable labels for your products, or make barcodes for products that don't have one." actions={<BranchSelect value={branch.id} onChange={setBranch} />} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      <div className="flex flex-wrap items-start gap-5">
        <Card className="min-w-0 flex-[2_1_480px]">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="m-0 mr-auto text-base font-semibold">Products</h2>
            <Button variant="ghost" onClick={() => setCopies(Object.fromEntries(visible.map((p) => [p.id, Math.max(1, Math.round(Math.max(0, p.stockMilli) / 1000)) ])))}>
              One label per item in stock
            </Button>
            <Button variant="ghost" onClick={() => setCopies({})}>
              Clear
            </Button>
          </div>
          <label htmlFor="bc-q" className="sr-only">
            Search products
          </label>
          <input id="bc-q" type="search" placeholder="Search name, SKU or barcode" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 h-11 w-full rounded-[10px] border border-line-strong bg-white px-3.5 text-sm" />
          <ul className="m-0 flex max-h-[420px] list-none flex-col overflow-auto p-0">
            {visible.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 border-t border-cream py-2 first:border-t-0">
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{p.name}</strong>
                  <span className="text-xs text-muted">{p.barcode ? `${kindFor(p.barcode) === "EAN13" ? "EAN-13" : "Code 128"} ${p.barcode}` : p.sku ? `SKU ${p.sku} (no barcode)` : "No barcode"} · {formatMoney(p.price)}</span>
                </span>
                <label className="flex items-center gap-2 text-sm">
                  Labels
                  <input type="number" min={0} max={500} inputMode="numeric" value={copies[p.id] ?? 0} onChange={(e) => setCopies({ ...copies, [p.id]: Math.max(0, Math.min(500, Number(e.target.value) || 0)) })} aria-label={`Labels for ${p.name}`} className="h-11 w-20 rounded-[10px] border border-line-strong bg-white px-2 text-right" />
                </label>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex-[1_1_300px]">
          <div className="flex flex-col gap-4">
            <SelectField label="Labels" value={layout} onChange={(e) => setLayout(e.target.value as Layout)}>
              {(Object.keys(LAYOUTS) as Layout[]).map((k) => (
                <option key={k} value={k}>
                  {LAYOUTS[k].label}
                </option>
              ))}
            </SelectField>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="size-5 accent-indigo" /> Product name
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="size-5 accent-indigo" /> Price ({branch.code})
            </label>
            <p className="m-0 text-sm">
              <strong>{labels.length}</strong> label{labels.length === 1 ? "" : "s"}
              {LAYOUTS[layout].page === "A4" && labels.length ? ` on ${Math.ceil(labels.length / (LAYOUTS[layout].cols * LAYOUTS[layout].rows))} sheet(s)` : ""}
            </p>
            {chosen.some((p) => !p.barcode) ? (
              <Alert tone="warn">
                {chosen.filter((p) => !p.barcode).length} chosen product(s) have no barcode{missing.length ? `, and ${missing.length} have no SKU either` : ""}.{" "}
                <Button variant="secondary" busy={busy} onClick={() => void makeBarcodes()} className="mt-2">
                  Make barcodes for them
                </Button>
              </Alert>
            ) : null}
            <Button disabled={!labels.length} onClick={() => setPrinting("sheet")} className="h-[52px] text-base">
              Print labels
            </Button>
          </div>
        </Card>
      </div>

      {labels.length ? (
        <section aria-label="Preview" className="mt-5">
          <h2 className="mt-0 mb-2 text-base font-semibold">Preview</h2>
          <div className="max-h-[420px] overflow-auto rounded-xl border border-line bg-cream p-3">
            <div className="origin-top-left scale-[0.6]" style={{ width: "fit-content" }}>
              <Sheet labels={labels.slice(0, LAYOUTS[layout].cols * LAYOUTS[layout].rows)} layout={layout} showName={showName} showPrice={showPrice} />
            </div>
          </div>
        </section>
      ) : null}

      <Card className="mt-5">
        <h2 className="mt-0 mb-3 text-base font-semibold">Single label</h2>
        <div className="flex flex-wrap items-end gap-3">
          <SelectField label="Type" value={single.kind} onChange={(e) => setSingle({ ...single, kind: e.target.value as Kind })}>
            <option value="CODE128">Code 128 (any text)</option>
            <option value="EAN13">EAN-13 (12–13 digits)</option>
            <option value="QR">QR code</option>
          </SelectField>
          <Field label="Value" value={single.value} onChange={(e) => setSingle({ ...single, value: e.target.value })} className="min-w-[200px] flex-1" placeholder={single.kind === "EAN13" ? "890123456789" : "SKU-001 or any text"} />
          <Field label="Label (optional)" value={single.label} onChange={(e) => setSingle({ ...single, label: e.target.value })} className="min-w-[160px] flex-1" />
          <Button variant="secondary" disabled={!single.value.trim()} onClick={() => void downloadSingle()}>
            Download PNG
          </Button>
          <Button disabled={!single.value.trim()} onClick={() => setPrinting("single")}>
            Print
          </Button>
        </div>
        {single.value.trim() ? (
          <div className="mt-4 flex h-32 w-72 flex-col items-center justify-center rounded-xl border border-line bg-white p-3">
            {single.label ? <span className="text-sm font-semibold">{single.label}</span> : null}
            <Barcode value={single.value.trim()} kind={single.kind} height={60} fontSize={14} />
          </div>
        ) : null}
      </Card>

      {printing ? (
        <div className="print-area fixed top-0 left-[-10000px]" aria-hidden="true">
          {printing === "sheet" ? (
            <Sheet labels={labels} layout={layout} showName={showName} showPrice={showPrice} />
          ) : (
            <Sheet labels={[{ key: "single", code: single.value.trim(), name: single.label, price: "", kind: single.kind }]} layout="roll-50x25" showName={Boolean(single.label)} showPrice={false} />
          )}
        </div>
      ) : null}
    </div>
  );
}
