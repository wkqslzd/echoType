/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COGNITO_USER_POOL_ID: string;
  readonly VITE_COGNITO_CLIENT_ID: string;
  readonly VITE_COGNITO_REGION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /** Set by auth-phase5-probe Part F to simulate Cognito deleteUser failure once. */
  __echotypeSimulateCognitoDeleteFailOnce?: boolean;
}
