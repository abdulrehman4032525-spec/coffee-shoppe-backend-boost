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

const ReservationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(5).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "time must be HH:MM"),
  partySize: z.coerce.number().int().min(1).max(50),
  specialRequests: z.string().trim().max(2000).optional().nullable(),
});

const OWNER_EMAIL = "info@coffeeshoppe.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/public/reservations")({
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

        const parsed = ReservationSchema.safeParse(body);
        if (!parsed.success) {
          return json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, 400);
        }
        const data = parsed.data;

        const { data: row, error } = await supabaseAdmin
          .from("reservations")
          .insert({
            name: data.name,
            email: data.email,
            phone: data.phone,
            reservation_date: data.date,
            reservation_time: data.time,
            party_size: data.partySize,
            special_requests: data.specialRequests ?? null,
          })
          .select()
          .single();

        if (error) {
          console.error("[reservations] insert error", error);
          return json({ ok: false, error: "Could not save reservation" }, 500);
        }

        // Fire emails (non-blocking failures)
        await Promise.allSettled([
          sendTransactionalEmail({
            templateName: "reservation-confirmation",
            recipientEmail: data.email,
            idempotencyKey: `res-confirm-${row.id}`,
            templateData: {
              name: data.name,
              date: data.date,
              time: data.time,
              partySize: data.partySize,
            },
          }),
          sendTransactionalEmail({
            templateName: "reservation-owner-notify",
            recipientEmail: OWNER_EMAIL,
            idempotencyKey: `res-owner-${row.id}`,
            templateData: {
              name: data.name,
              email: data.email,
              phone: data.phone,
              date: data.date,
              time: data.time,
              partySize: data.partySize,
              specialRequests: data.specialRequests ?? "",
            },
          }),
        ]);

        return json({ ok: true, id: row.id });
      },
    },
  },
});
