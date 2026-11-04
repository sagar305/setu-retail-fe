import { useState } from "react";
import { Alert, Card, PageHeader } from "../components/ui";
import { setSettings, useSettings } from "../hooks/useSettings";
import { apiPatch, type Settings } from "../lib/api";
import { errorMessage } from "../lib/format";
import { TOOL_GROUPS, TOOLS, toolOn } from "../lib/tools";
import { SettingsTabs } from "./SettingsTabs";

/** Settings → Connected tools: the owner switches each tool on or off. */
export function ConnectedToolsPage() {
  const s = useSettings();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(slug: string, on: boolean) {
    if (!s) return;
    setError(null);
    setSaving(slug);
    // Show the change at once; put it back if the save fails.
    setSettings({ ...s, tools: { ...s.tools, [slug]: on } });
    try {
      setSettings(await apiPatch<Settings>("/settings", { tools: { [slug]: on } }));
    } catch (err) {
      setSettings(s);
      setError(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="w-full">
      <PageHeader title="Settings" />
      <SettingsTabs />
      <p className="mt-0 mb-4 max-w-3xl text-sm text-muted">Switched-off tools leave the menu for everyone. Their data stays; switch a tool back on and it's all there.</p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {!s ? <p className="text-muted">Loading…</p> : null}
      <div className="flex flex-col gap-5">
        {s
          ? TOOL_GROUPS.map((g) => (
              <Card key={g}>
                <h2 className="mt-0 mb-2 text-base font-semibold">{g}</h2>
                <ul className="m-0 flex list-none flex-col p-0">
                  {TOOLS.filter((t) => t.group === g).map((t) => {
                    const on = toolOn(s.tools, t.slug);
                    return (
                      <li key={t.slug} className="flex items-center gap-4 border-t border-cream py-3 first:border-t-0">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-semibold">{t.name}</span>
                          <span className="text-[13px] text-muted">
                            {t.description}
                            {t.unlocks ? ` Also turns on: ${t.unlocks}.` : ""}
                            {!t.path ? " Arrives in the next update." : ""}
                          </span>
                        </span>
                        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                          <input type="checkbox" role="switch" checked={on} disabled={saving === t.slug} onChange={(e) => void toggle(t.slug, e.target.checked)} className="size-5 accent-indigo" aria-label={`${t.name} ${on ? "on" : "off"}`} />
                          {on ? "On" : "Off"}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))
          : null}
      </div>
    </div>
  );
}
