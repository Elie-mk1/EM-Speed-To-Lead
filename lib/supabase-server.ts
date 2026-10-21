import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Server-only Supabase client. The service role key is read from server env vars
// and this file can never be imported into browser code ('server-only' fails the build if it is).
export function supabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
