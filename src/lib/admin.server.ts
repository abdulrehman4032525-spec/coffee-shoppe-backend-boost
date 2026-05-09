// Server-only helpers. Never imported by client code.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Response("Role check failed", { status: 500 });
  if (!data) throw new Response("Forbidden", { status: 403 });
}
