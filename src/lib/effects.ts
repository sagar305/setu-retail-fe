// Show a change on screen before the cloud has it (Phase 9b): apply a pending
// change's effects to a cached answer. Pure, so it's easy to test.
import type { Effect } from "../offline/db";

type Json = unknown;

/** Every object with this id gets the given fields (only fields it already has). */
function update(v: Json, id: string, fields: Record<string, unknown>): Json {
  if (Array.isArray(v)) return v.map((x) => update(x, id, fields));
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) out[k] = update(x, id, fields);
    if (o["id"] === id) for (const [k, x] of Object.entries(fields)) if (k in o) out[k] = x;
    return out;
  }
  return v;
}

/** Objects with this id disappear from every list. */
function remove(v: Json, id: string): Json {
  if (Array.isArray(v)) return v.filter((x) => !(x && typeof x === "object" && (x as { id?: unknown }).id === id)).map((x) => remove(x, id));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, remove(x, id)]));
  return v;
}

export function applyEffects(path: string, data: Json, effects: readonly Effect[]): Json {
  let out = data;
  for (const e of effects) {
    if (e.kind === "update") out = update(out, e.id, e.fields);
    else if (e.kind === "remove") out = remove(out, e.id);
    else if (e.kind === "insert" && path.startsWith(e.into) && out && typeof out === "object") {
      const o = out as Record<string, unknown>;
      const list = o[e.key];
      if (Array.isArray(list) && !list.some((x) => (x as { id?: unknown })?.id === e.item.id)) {
        out = { ...o, [e.key]: [e.item, ...list], ...(typeof o["total"] === "number" ? { total: (o["total"] as number) + 1 } : {}) };
      }
    }
  }
  return out;
}
