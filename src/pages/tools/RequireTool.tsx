import { Link, Outlet } from "react-router-dom";
import { useMe } from "../../auth/AuthProvider";
import { Alert } from "../../components/ui";
import { useSettings } from "../../hooks/useSettings";
import { toolBySlug, toolOn, type ToolSlug } from "../../lib/tools";

/** A tool's screens, while the owner has it switched on. */
export function RequireTool({ slug }: { slug: ToolSlug }) {
  const me = useMe();
  const settings = useSettings();
  if (!settings) return <p className="text-muted">Loading…</p>;
  if (toolOn(settings.tools, slug)) return <Outlet />;
  return (
    <Alert tone="warn">
      {toolBySlug(slug).name} is switched off.{" "}
      {me.user.role === "OWNER" ? <Link to="/settings/tools">Turn it on in Settings → Connected tools.</Link> : "Ask the owner to turn it on."}
    </Alert>
  );
}
