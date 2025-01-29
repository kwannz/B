/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_THIRDWEB_CLIENT_ID: string;
  readonly VITE_THIRDWEB_SECRET_KEY?: string;
  readonly VITE_NODE_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
