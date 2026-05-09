import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmail } from "@/lib/email/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const ContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(1).max(5000),
});

const OWNER_EMAIL = "info@coffeeshoppe.com";

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/public/contact")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: "Invalid JSON" }, 400);
        }
        const parsed = ContactSchema.safeParse(body);
        if (!parsed.success) {
          return json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, 400);
        }
        const data = parsed.data;

        const { data: row, error } = await supabaseAdmin
          .from("contact_messages")
          .insert({ name: data.name, email: data.email, message: data.message })
          .select()
          .single();

        if (error) {
          console.error("[contact] insert error", error);
          return json({ ok: false, error: "Could not save message" }, 500);
        }

        await sendTransactionalEmail({
          templateName: "contact-owner-notify",
          recipientEmail: OWNER_EMAIL,
          idempotencyKey: `contact-${row.id}`,
          templateData: {
            name: data.name,
            email: data.email,
            message: data.message,
          },
        });

        return json({ ok: true, id: row.id });
      },
    },
  },
});
