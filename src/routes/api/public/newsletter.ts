import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getClientIp, rateLimit, maybeSweep } from "@/lib/rate-limit";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const NewsletterSchema = z.object({
  email: z.string().trim().email().max(255),
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/public/newsletter")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        maybeSweep();
        const ip = getClientIp(request);
        const rl = rateLimit({ key: `news:${ip}`, limit: 10, windowMs: 60_000 });
        if (!rl.ok) {
          return new Response(
            JSON.stringify({ ok: false, error: "Too many requests" }),
            { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(rl.retryAfterSec), ...corsHeaders } }
          );
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: "Invalid JSON" }, 400);
        }
        const parsed = NewsletterSchema.safeParse(body);
        if (!parsed.success) {
          return json({ ok: false, error: "Invalid email" }, 400);
        }
        const email = parsed.data.email.toLowerCase();

        const { error } = await supabaseAdmin
          .from("newsletter_subscribers")
          .insert({ email });

        // Treat duplicates as success (idempotent subscribe)
        if (error && !/duplicate key|unique/i.test(error.message)) {
          console.error("[newsletter] insert error", error);
          return json({ ok: false, error: "Could not subscribe" }, 500);
        }

        return json({ ok: true });
      },
    },
  },
});
