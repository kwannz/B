/// <reference types="vite/client" />

/// <reference types="vite/client" />

declare module '@thirdweb-dev/react' {
  export * from '@thirdweb-dev/react';
}

interface ImportMetaEnv {
  readonly VITE_THIRDWEB_CLIENT_ID: string;
  readonly VITE_THIRDWEB_SECRET_KEY?: string;
  readonly VITE_NODE_ENV?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
