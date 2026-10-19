/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public site (used by the Android app for /api/ice and invite links). */
  readonly VITE_PUBLIC_URL?: string;
  /** Optional self-hosted PeerJS signalling server (default: PeerJS free cloud server). */
  readonly VITE_PEER_HOST?: string;
  readonly VITE_PEER_PORT?: string;
  readonly VITE_PEER_PATH?: string;
  readonly VITE_PEER_SECURE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
