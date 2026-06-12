import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createLiveInput,
  deleteLiveInput,
  getLiveInput,
  readCloudflareStreamConfig,
  type StreamPlanTier,
} from "../_shared/cloudflareStream.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function serviceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const svcKey = (
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SERVICE_ROLE_KEY") ??
    ""
  ).trim();
  if (!supabaseUrl || !svcKey) return null;
  return createClient(supabaseUrl, svcKey);
}

function isRegalMode(mode: string | null | undefined): boolean {
  return mode === "regal" || mode === "cloudflare";
}

async function resolveRegalSession(
  admin: ReturnType<typeof createClient>,
  accessCode: string,
  deviceId: string,
) {
  const code = accessCode.toUpperCase().trim();
  const { data: session, error: sessionError } = await admin
    .from("mixer_sessions")
    .select("id, plan_id, connection_mode, is_active, expires_at")
    .eq("access_code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (sessionError || !session) {
    return { error: json(404, { error: "Session not found or inactive" }) };
  }

  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    return { error: json(410, { error: "Session expired" }) };
  }

  if (!isRegalMode(session.connection_mode)) {
    return { error: json(403, { error: "Regal Cloud is not enabled for this session" }) };
  }

  const planId = String(session.plan_id ?? "");
  if (planId !== "pro" && planId !== "pro_master") {
    return { error: json(403, { error: "Regal Cloud requires a Pro or Pro Master plan" }) };
  }

  const { data: device, error: deviceError } = await admin
    .from("paired_devices")
    .select("id, device_id, stream_id, whip_url, whep_url, label")
    .eq("session_id", session.id)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (deviceError || !device) {
    return { error: json(404, { error: "Device not paired to this session" }) };
  }

  return {
    session,
    device,
    planId: planId as StreamPlanTier,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const streamConfig = readCloudflareStreamConfig();
  if (!streamConfig) {
    return json(503, { error: "Regal Cloud streaming is not configured" });
  }

  const admin = serviceClient();
  if (!admin) {
    return json(500, { error: "Service unavailable" });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const action = String(body.action ?? "provision");
  const accessCode = String(body.access_code ?? "").trim();
  const deviceId = String(body.device_id ?? "").trim();

  if (!accessCode || !deviceId) {
    return json(400, { error: "access_code and device_id are required" });
  }

  const resolved = await resolveRegalSession(admin, accessCode, deviceId);
  if ("error" in resolved) return resolved.error;

  const { session, device, planId } = resolved;

  if (action === "delete") {
    const streamId = device.stream_id ? String(device.stream_id) : "";
    if (streamId) {
      await deleteLiveInput(streamConfig, streamId).catch(() => undefined);
    }
    await admin
      .from("paired_devices")
      .update({ stream_id: null, whip_url: null, whep_url: null })
      .eq("id", device.id);
    return json(200, { deleted: true });
  }

  if (action !== "provision") {
    return json(400, { error: "Unknown action" });
  }

  let endpoints = null as Awaited<ReturnType<typeof getLiveInput>> | null;
  const existingId = device.stream_id ? String(device.stream_id) : "";
  if (existingId) {
    endpoints = await getLiveInput(streamConfig, existingId);
  }

  if (!endpoints) {
    endpoints = await createLiveInput(streamConfig, {
      session_id: String(session.id),
      device_id: deviceId,
      label: String(device.label ?? deviceId),
    }, planId);
  }

  await admin
    .from("paired_devices")
    .update({
      stream_id: endpoints.uid,
      whip_url: endpoints.whipUrl,
      whep_url: endpoints.whepUrl,
      status: "connecting",
      updated_at: new Date().toISOString(),
    })
    .eq("id", device.id);

  return json(200, {
    stream_id: endpoints.uid,
    whip_url: endpoints.whipUrl,
    whep_url: endpoints.whepUrl,
    plan_id: planId,
    quality_tier: planId === "pro_master" ? "uhd" : "hd",
    connection_mode: "regal",
  });
});
