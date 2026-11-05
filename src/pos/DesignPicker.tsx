import type { ReceiptTemplate } from "../lib/api";

/** Switch receipt design before printing (only when there's more than one). */
export function DesignPicker({ templates, value, onChange }: { templates: ReceiptTemplate[]; value: string | null; onChange: (id: string) => void }) {
  if (templates.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Receipt design
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-[10px] border border-line-strong bg-white px-2 text-ink">
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.paperSize})
          </option>
        ))}
      </select>
    </label>
  );
}
