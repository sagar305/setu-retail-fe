import type { ReactNode } from "react";

/** A scrollable table: first column left, the rest right-aligned (numbers). */
export function DataTable({ head, rows, empty = "Nothing here yet.", minW = 640, left = 1 }: { head: ReactNode[]; rows: { key: string; cells: ReactNode[]; muted?: boolean }[]; empty?: string; minW?: number; left?: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full border-collapse text-sm" style={{ minWidth: minW }}>
        <thead>
          <tr className="bg-paper text-left text-xs text-muted">
            {head.map((h, i) => (
              <th key={i} className={`px-3 py-2.5 font-medium first:pl-4 ${i >= left ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={`border-t border-line ${r.muted ? "text-muted line-through" : ""}`}>
              {r.cells.map((c, j) => (
                <td key={j} className={`px-3 py-2.5 first:pl-4 ${j >= left ? "text-right" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="m-0 px-4 py-5 text-center text-muted">{empty}</p> : null}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "warn" | "ok" }) {
  return (
    <div className="flex min-w-[150px] flex-1 flex-col gap-1 rounded-2xl border border-line bg-white p-4">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`text-xl font-bold ${tone === "warn" ? "text-[#A3361F]" : tone === "ok" ? "text-ok" : "text-indigo"}`}>{value}</span>
    </div>
  );
}
