/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** "true" on the demo build only (lib/demo.ts). */
  readonly VITE_DEMO_MODE?: string;
  /** The demo shop's "login|password", shown on the demo sign-in screen. Public by design. */
  readonly VITE_DEMO_LOGIN?: string;
  /** Where the demo sends real sign-ups. */
  readonly VITE_PRODUCTION_APP_URL?: string;
}
