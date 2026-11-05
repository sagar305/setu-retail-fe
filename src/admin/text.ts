import type { AccountStatus, Activity } from "./api";

export const STATUS_LABEL: Record<AccountStatus, string> = {
  trial: "Trial",
  paid: "Paid",
  granted: "Free days",
  expired: "Ended",
  unverified: "Not verified",
  locked: "Locked",
};

export const STATUS_TONE: Record<AccountStatus, "info" | "ok" | "warn" | "error" | "muted"> = {
  trial: "info",
  paid: "ok",
  granted: "info",
  expired: "warn",
  unverified: "muted",
  locked: "error",
};

export const SOURCE_LABEL: Record<string, string> = { TRIAL: "Free trial", KEY: "Key", GRANT: "Free days (Setu)" };
export const MODE_LABEL: Record<string, string> = { EXTEND: "Added on", SWITCH_NOW: "Switched now", START_LATER: "Starts later" };

export const planLabel = (code: string | null, name: string | null) => (code?.startsWith("custom-") ? "Custom" : (name ?? "—"));

const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-IN") : v === null ? "unlimited" : String(v ?? ""));

/** One line for each thing the Setu team (or the system) did. */
export function describeActivity(e: Pick<Activity, "action" | "data">): string {
  const d = (e.data ?? {}) as Record<string, unknown>;
  switch (e.action) {
    case "admin.signed_in":
      return "Signed in";
    case "admin.sign_in_failed":
      return `Wrong ${d.what === "code" ? "code" : "password"}${d.locked ? " · locked for 15 minutes" : ""}`;
    case "admin.two_factor_set_up":
      return "Linked an authenticator app";
    case "admin.password_set":
      return "Set their password";
    case "admin.invited":
      return `Invited ${String(d.email ?? "")}`;
    case "admin.reset":
      return `Reset sign-in for ${String(d.email ?? "")}`;
    case "admin.disabled":
      return `Turned off ${String(d.email ?? "")}`;
    case "admin.enabled":
      return `Turned on ${String(d.email ?? "")}`;
    case "account.locked":
      return `Locked the account: ${String(d.reason ?? "")}`;
    case "account.unlocked":
      return `Unlocked the account${d.note ? `: ${String(d.note)}` : ""}`;
    case "account.days_added":
      return `Added ${n(d.days)} free days (${String(d.plan ?? "")}): ${String(d.reason ?? "")}`;
    case "account.verification_resent":
      return `Sent a new verification link to ${String(d.to ?? "")}`;
    case "account.reset_sent":
      return `Sent a password reset link to ${String(d.to ?? "")}`;
    case "account.reminder_sent":
      return "Sent a plan reminder";
    case "reminders.sent_bulk":
      return `Sent plan reminders to accounts ending within ${n(d.withinDays)} days: ${n(d.sent)} sent, ${n(d.skipped)} skipped`;
    case "reminders.sent_automatic":
      return `Daily reminders: ${n(d.sent)} sent`;
    case "key.issued":
      return `Issued a Contact-sales key: ${n(d.days)} days, ${n(d.maxBranches)} branches${d.note ? ` · ${String(d.note)}` : ""}`;
    case "key.revoked":
      return "Cancelled a Contact-sales key";
    default:
      return e.action;
  }
}

export const ACTIVITY_GROUPS: { prefix: string; label: string }[] = [
  { prefix: "", label: "Everything" },
  { prefix: "account.", label: "Account changes" },
  { prefix: "key.", label: "Contact-sales keys" },
  { prefix: "reminders.", label: "Reminders" },
  { prefix: "admin.", label: "Team & sign-ins" },
];

export const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
export const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
