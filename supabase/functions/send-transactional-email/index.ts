import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildEmail } from "../_shared/templates.ts";
import { sendEmail } from "../_shared/mailer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-email-webhook-secret",
};

function authorized(req: Request): boolean {
  const webhookSecret = Deno.env.get("EMAIL_WEBHOOK_SECRET");
  const headerSecret = req.headers.get("x-email-webhook-secret");
  if (webhookSecret && headerSecret === webhookSecret) return true;

  const auth = req.headers.get("authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return Boolean(serviceKey && auth === `Bearer ${serviceKey}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const processPending = Boolean(body.process_pending);
    const queueIds: string[] = [];

    if (processPending) {
      const { data: pending } = await supabase
        .from("email_queue")
        .select("id")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(25);
      queueIds.push(...((pending ?? []) as { id: string }[]).map((r) => r.id));
    } else if (body.queue_id) {
      queueIds.push(String(body.queue_id));
    } else if (body.template && body.email_to) {
      const { data: inserted, error } = await supabase
        .from("email_queue")
        .insert({
          email_to: body.email_to,
          template: body.template,
          payload: body.payload ?? {},
          user_id: body.user_id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      queueIds.push(inserted.id as string);
    } else {
      return new Response(JSON.stringify({ error: "queue_id or direct send required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const queueId of queueIds) {
      const { data: row, error: fetchError } = await supabase
        .from("email_queue")
        .select("*")
        .eq("id", queueId)
        .single();

      if (fetchError || !row) {
        results.push({ queue_id: queueId, ok: false, error: fetchError?.message ?? "not found" });
        continue;
      }

      if (row.status === "sent") {
        results.push({ queue_id: queueId, ok: true, skipped: true });
        continue;
      }

      await supabase.from("email_queue").update({ status: "processing", attempts: (row.attempts ?? 0) + 1 }).eq("id", queueId);

      const { subject, html } = buildEmail(row.template, (row.payload ?? {}) as Record<string, unknown>);
      const sent = await sendEmail({ to: row.email_to, subject, html });

      if (sent.ok) {
        await supabase.from("email_queue").update({
          status: sent.skipped ? "skipped" : "sent",
          sent_at: new Date().toISOString(),
          last_error: sent.skipped ? "RESEND_API_KEY not configured" : null,
        }).eq("id", queueId);
        results.push({ queue_id: queueId, ok: true, skipped: sent.skipped });
      } else {
        await supabase.from("email_queue").update({
          status: "failed",
          last_error: sent.error ?? "send failed",
        }).eq("id", queueId);
        results.push({ queue_id: queueId, ok: false, error: sent.error });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
