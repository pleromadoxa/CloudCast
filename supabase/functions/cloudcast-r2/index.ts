import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  deleteR2Objects,
  isOwnedRecordingPath,
  isR2Configured,
  presignDownload,
  presignUpload,
  readR2Config,
  recordingObjectKey,
} from "../_shared/r2.ts";

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

async function getAuthUser(req: Request): Promise<{ id: string; client: ReturnType<typeof createClient> } | Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "Unauthorized" });
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json(401, { error: "Unauthorized" });
  return { id: user.id, client };
}

async function assertRecordingQuota(
  userClient: ReturnType<typeof createClient>,
  sizeBytes: number,
): Promise<Response | null> {
  const { data, error } = await userClient.rpc("get_recording_storage_usage");
  if (error) return json(403, { error: error.message });

  const usage = (data ?? {}) as Record<string, unknown>;
  const quota = Number(usage.quota_bytes ?? 0);
  const used = Number(usage.used_bytes ?? 0);
  const remaining = Number(usage.remaining_bytes ?? Math.max(quota - used, 0));

  if (quota <= 0) {
    return json(403, { error: "Cloud recording storage is not included on your plan" });
  }
  if (sizeBytes > 0 && sizeBytes > remaining) {
    return json(403, { error: "Cloud storage quota exceeded" });
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }
  if (!isR2Configured()) {
    return json(503, { error: "CloudCast cloud storage is not available" });
  }

  const config = readR2Config()!;
  const auth = await getAuthUser(req);
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const action = String(body.action ?? "presign-upload");

  if (action === "presign-upload") {
    const mimeType = String(body.mime_type ?? "video/webm").trim() || "video/webm";
    const sizeBytes = Math.max(0, Number(body.size_bytes ?? 0));
    const quotaErr = await assertRecordingQuota(auth.client, sizeBytes);
    if (quotaErr) return quotaErr;

    const recordingId = crypto.randomUUID();
    const storagePath = `${auth.id}/${recordingId}.webm`;
    const objectKey = recordingObjectKey(storagePath);
    const presigned = await presignUpload(config, objectKey, mimeType);

    return json(200, {
      uploadUrl: presigned.uploadUrl,
      storagePath,
      objectKey,
    });
  }

  if (action === "presign-download") {
    const storagePath = String(body.storage_path ?? "").trim();
    const fileName = String(body.file_name ?? "recording.webm").trim() || "recording.webm";
    if (!isOwnedRecordingPath(auth.id, storagePath)) {
      return json(403, { error: "Invalid storage path" });
    }

    const url = await presignDownload(config, recordingObjectKey(storagePath), fileName);
    return json(200, { url });
  }

  if (action === "delete") {
    const storagePath = String(body.storage_path ?? "").trim();
    if (!isOwnedRecordingPath(auth.id, storagePath)) {
      return json(403, { error: "Invalid storage path" });
    }

    const deleted = await deleteR2Objects(config, [recordingObjectKey(storagePath)]);
    return json(200, { deleted });
  }

  return json(400, { error: "Unknown action" });
});
