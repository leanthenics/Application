import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/**
 * Service-role Supabase client — SERVER ONLY. It bypasses RLS, so it's used for the
 * credits DB (the source of truth): spending, refunding and granting credits via the
 * SECURITY DEFINER functions (see docs/private/sql/credits.sql).
 *
 * Lazy singleton (mirrors ai/gemini.ts): a missing URL/key fails on first use with a
 * clear message rather than crashing the process at import time.
 */
let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — cannot access the credits DB',
    );
  }
  if (!client) {
    client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      // No user session on the server — this client only ever acts as service_role.
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
