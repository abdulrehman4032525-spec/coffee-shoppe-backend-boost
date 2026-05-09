/**
 * Sends a transactional email via the Lovable email queue.
 * Gracefully no-ops (logs only) if the email infrastructure / sender domain
 * is not yet configured. This way form submissions never fail just because
 * email is not wired up yet.
 */
export async function sendTransactionalEmail(params: {
  templateName: string;
  recipientEmail: string;
  idempotencyKey?: string;
  templateData?: Record<string, unknown>;
  authToken?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (params.authToken) headers["Authorization"] = `Bearer ${params.authToken}`;

    const res = await fetch("/lovable/email/transactional/send", {
      method: "POST",
      headers,
      body: JSON.stringify({
        templateName: params.templateName,
        recipientEmail: params.recipientEmail,
        idempotencyKey: params.idempotencyKey,
        templateData: params.templateData,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[email] send failed (${res.status}): ${text || res.statusText}`);
      return { ok: false, skipped: true, error: text || res.statusText };
    }
    return { ok: true };
  } catch (err) {
    console.warn("[email] send error (likely email infra not set up):", err);
    return { ok: false, skipped: true, error: String(err) };
  }
}
