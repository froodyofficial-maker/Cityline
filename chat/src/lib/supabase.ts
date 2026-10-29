import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, isConfigured } from './config';

// When the app is not configured yet we still export a client pointed at a
// placeholder so imports never crash; the setup screen is shown instead.
export const supabase: SupabaseClient = createClient(
  isConfigured ? config.supabaseUrl : 'http://localhost:54321',
  isConfigured ? config.supabaseAnonKey : 'missing-key',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'cityline-auth' },
    realtime: { params: { eventsPerSecond: 20 } },
  },
);

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

type RpcResult<T> = { data: T | null; error: { message: string; code?: string } | null };

/** Calls a database function and throws a readable error on failure. */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = (await supabase.rpc(fn, args)) as RpcResult<T>;
  if (error) throw new ApiError(friendlyError(error.message), error.code);
  return data as T;
}

export function friendlyError(message: string) {
  if (!message) return 'Something went wrong';
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return 'Could not reach the server. Check your connection.';
  if (/JWT expired/i.test(message)) return 'Your session expired — please sign in again.';
  if (/row-level security/i.test(message)) return 'You do not have permission to do that.';
  if (/duplicate key/i.test(message)) return 'That already exists.';
  if (/Could not find the function/i.test(message)) return 'The database is missing a function. Re-run supabase/schema.sql in the SQL editor.';
  return message;
}

/** Throws when a supabase query returned an error. */
export function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new ApiError(friendlyError(res.error.message), res.error.code);
  return res.data;
}
