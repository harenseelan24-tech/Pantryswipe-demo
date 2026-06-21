import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] SUPABASE_URL or SUPABASE_ANON_KEY is missing — auth verification disabled."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Verify a Bearer token from the Authorization header.
 * Returns the user object or null if invalid/missing.
 */
export async function verifyToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
