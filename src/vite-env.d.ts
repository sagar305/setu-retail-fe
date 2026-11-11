/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** "true" on the demo build only (lib/demo.ts). */
  readonly VITE_DEMO_MODE?: string;
  /** The demo logins, "Label=login|password;…" (lib/demo.ts). Shown on the demo sign-in screen; public by design. */
  readonly VITE_DEMO_LOGIN?: string;
  /** Where the demo sends real sign-ups. */
  readonly VITE_PRODUCTION_APP_URL?: string;
}
