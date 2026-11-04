// CSV in and out. Exports open in Excel/Sheets; imports accept our template
// and the free Browser POS exports (same headers).

export function toCsv(headers: string[], rows: unknown[][]): string {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel reads ₹ and Indian names as UTF-8.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** RFC 4180-ish: quotes, escaped quotes, commas/newlines inside quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Rows as objects keyed by normalised header ("Selling Price" → "sellingprice"). */
export function csvRecords(text: string): { headers: string[]; records: Record<string, string>[] } {
  const [head, ...body] = parseCsv(text);
  const headers = (head ?? []).map((h) => h.trim());
  const keys = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9%]/g, ""));
  return { headers, records: body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()]))) };
}
