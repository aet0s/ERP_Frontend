/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_DEFAULT_CURRENCY?: string;
  readonly VITE_DEFAULT_LOCALE?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_ENABLE_DEBUG_LOGS?: string;
  readonly VITE_ENABLE_MOCK_DATA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
