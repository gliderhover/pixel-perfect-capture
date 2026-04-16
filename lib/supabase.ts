import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as typeof globalThis & {
  __supabaseAdminClient?: SupabaseClient;
  __supabaseLoggedOnce?: boolean;
};

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL. Pull envs with `vercel env pull .env.local` or set Vercel project env vars."
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Server routes require a service-role key for read/write operations."
    );
  }
  return { url, serviceRoleKey };
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (!globalForSupabase.__supabaseAdminClient) {
    const { url, serviceRoleKey } = getSupabaseEnv();
    globalForSupabase.__supabaseAdminClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  if (process.env.DB_DEBUG_LOGS === "1" && !globalForSupabase.__supabaseLoggedOnce) {
    // eslint-disable-next-line no-console
    console.info("[supabase] Admin client initialized", new Date().toISOString());
    globalForSupabase.__supabaseLoggedOnce = true;
  }

  return globalForSupabase.__supabaseAdminClient;
}

