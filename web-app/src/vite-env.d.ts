/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POWER_AUTOMATE_URL?: string;
  readonly VITE_TACKER_KEY?: string;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
