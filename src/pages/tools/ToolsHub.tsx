import { Link } from "react-router-dom";
import { useMe } from "../../auth/AuthProvider";
import { Badge, PageHeader } from "../../components/ui";
import { useSettings } from "../../hooks/useSettings";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { Alert } from "../../components/ui";
import { TOOL_GROUPS, toolsFor } from "../../lib/tools";

/** Connected tools that use the same sales, customers, products and suppliers as the POS. */
export function ToolsHubPage() {
  const me = useMe();
  const settings = useSettings();
  const tools = toolsFor(me.user.role, settings?.tools);
  const online = useOnlineStatus();
  const off = me.user.role === "OWNER" && settings ? Object.values(settings.tools).filter((on) => !on).length : 0;
  return (
    <div className="w-full">
      <PageHeader
        title="Connected tools"
        description="They all use the same sales, customers, products and suppliers as the POS. Nothing to re-type."
        actions={off ? <Link to="/settings/tools" className="text-sm font-semibold text-indigo">{off} switched off · manage</Link> : undefined}
      />
      {!online ? (
        <Alert tone="warn">
          No internet. You can still <Link to="/money">record payments and expenses on this counter</Link>; they sync when it's back.
        </Alert>
      ) : null}
      <div className="flex flex-col gap-6">
        {TOOL_GROUPS.map((g) => {
          const list = tools.filter((t) => t.group === g);
          if (!list.length) return null;
          return (
            <section key={g} className="flex flex-col gap-3">
              <h2 className="m-0 text-[15px] font-semibold text-muted">{g}</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
                {list.map((t) => {
                  const body = (
                    <>
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-semibold">{t.name}</span>
                        {!t.path ? <Badge tone="muted">Coming next</Badge> : t.offline ? <Badge tone="info">Works offline</Badge> : null}
                      </span>
                      <span className="text-[13px] leading-normal text-muted">{t.description}</span>
                      <span className="mt-auto text-xs font-medium text-[#6B4100]">{t.who}</span>
                    </>
                  );
                  const cls = "flex min-h-32 flex-col gap-2 rounded-2xl border border-line bg-white p-4 text-ink no-underline";
                  return t.path ? (
                    <Link key={t.slug} to={t.path} className={`${cls} hover:border-indigo`}>
                      {body}
                    </Link>
                  ) : (
                    <div key={t.slug} className={`${cls} opacity-70`} aria-disabled="true">
                      {body}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {!tools.length ? <p className="text-muted">No tools are switched on for you.</p> : null}
      </div>
    </div>
  );
}
