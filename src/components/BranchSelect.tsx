import { useMe } from "../auth/AuthProvider";

export function BranchSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const me = useMe();
  if (me.branches.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Branch
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-[10px] border border-line-strong bg-white px-2 text-ink">
        {me.branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.code})
          </option>
        ))}
      </select>
    </label>
  );
}
