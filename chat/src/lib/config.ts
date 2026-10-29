// Where the Supabase keys come from, in order:
//   1. .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), baked in at build time
//   2. public/config.js (window.CITYLINE_CONFIG), editable after building
//   3. the in-app setup screen (saved in this browser's localStorage)

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  giphyApiKey: string;
  turnUrl: string;
  turnUsername: string;
  turnCredential: string;
}

declare global {
  interface Window {
    CITYLINE_CONFIG?: Partial<AppConfig>;
  }
}

const STORAGE_KEY = 'cityline:config';

function fromStorage(): Partial<AppConfig> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

const env = import.meta.env;

function pick(...values: (string | undefined)[]) {
  for (const v of values) if (v && String(v).trim()) return String(v).trim();
  return '';
}

export function loadConfig(): AppConfig {
  const win = (typeof window !== 'undefined' && window.CITYLINE_CONFIG) || {};
  const local = fromStorage();
  return {
    supabaseUrl: pick(env.VITE_SUPABASE_URL, win.supabaseUrl, local.supabaseUrl).replace(/\/+$/, ''),
    supabaseAnonKey: pick(env.VITE_SUPABASE_ANON_KEY, win.supabaseAnonKey, local.supabaseAnonKey),
    giphyApiKey: pick(env.VITE_GIPHY_API_KEY, win.giphyApiKey, local.giphyApiKey),
    turnUrl: pick(env.VITE_TURN_URL, win.turnUrl, local.turnUrl),
    turnUsername: pick(env.VITE_TURN_USERNAME, win.turnUsername, local.turnUsername),
    turnCredential: pick(env.VITE_TURN_CREDENTIAL, win.turnCredential, local.turnCredential),
  };
}

export function saveLocalConfig(patch: Partial<AppConfig>) {
  const next = { ...fromStorage(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearLocalConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

export const config = loadConfig();
export const isConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);

// Upload limits per plan (bytes). The "media" bucket allows 50 MB, which is the
// Supabase free-plan maximum; raise both if you are on a paid plan.
export const UPLOAD_LIMITS = { free: 10 * 1024 * 1024, lite: 25 * 1024 * 1024, neon: 50 * 1024 * 1024 };
