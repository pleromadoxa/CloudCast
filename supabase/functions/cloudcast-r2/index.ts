import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  deleteR2Objects,
  isOwnedRecordingPath,
  isOwnedSymphonyPath,
  isR2Configured,
  isValidMobileAppStoragePath,
  mobileAppObjectKey,
  presignDownload,
  presignUpload,
  readR2Config,
  recordingObjectKey,
  symphonyObjectKey,
  replayObjectKey,
  isOwnedReplayPath,
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

async function assertAdmin(
  userClient: ReturnType<typeof createClient>,
): Promise<Response | null> {
  const { data, error } = await userClient.rpc("is_admin");
  if (error || !data) {
    return json(403, { error: "Admin access required" });
  }
  return null;
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

  // ── CloudCast Symphony / Regal Cloud Archive ──

  if (action === "symphony-presign-upload") {
    const mimeType = String(body.mime_type ?? "application/json").trim() || "application/json";
    const sizeBytes = Math.max(0, Number(body.size_bytes ?? 0));
    const projectId = String(body.project_id ?? crypto.randomUUID());
    const storagePath = `${auth.id}/${projectId}.ccsym`;
    const objectKey = symphonyObjectKey(storagePath);
    const presigned = await presignUpload(config, objectKey, mimeType);

    return json(200, {
      uploadUrl: presigned.uploadUrl,
      storagePath,
      objectKey,
    });
  }

  if (action === "symphony-presign-download") {
    const storagePath = String(body.storage_path ?? "").trim();
    const fileName = String(body.file_name ?? "project.ccsym").trim() || "project.ccsym";
    if (!isOwnedSymphonyPath(auth.id, storagePath)) {
      return json(403, { error: "Invalid storage path" });
    }

    const url = await presignDownload(config, symphonyObjectKey(storagePath), fileName);
    return json(200, { url });
  }

  if (action === "symphony-delete") {
    const storagePath = String(body.storage_path ?? "").trim();
    if (!isOwnedSymphonyPath(auth.id, storagePath)) {
      return json(403, { error: "Invalid storage path" });
    }

    const deleted = await deleteR2Objects(config, [symphonyObjectKey(storagePath)]);
    return json(200, { deleted });
  }

  // ── CloudCast Replay / Regal Cloud Clips ──

  if (action === "replay-presign-upload") {
    const mimeType = String(body.mime_type ?? "video/webm").trim() || "video/webm";
    const sizeBytes = Math.max(0, Number(body.size_bytes ?? 0));
    const quotaErr = await assertRecordingQuota(auth.client, sizeBytes);
    if (quotaErr) return quotaErr;

    const clipId = String(body.clip_id ?? crypto.randomUUID());
    const storagePath = `${auth.id}/${clipId}.webm`;
    const objectKey = replayObjectKey(storagePath);
    const presigned = await presignUpload(config, objectKey, mimeType);

    return json(200, {
      uploadUrl: presigned.uploadUrl,
      storagePath,
      objectKey,
      clipId,
    });
  }

  if (action === "replay-presign-download") {
    const storagePath = String(body.storage_path ?? "").trim();
    const fileName = String(body.file_name ?? "replay-clip.webm").trim() || "replay-clip.webm";
    if (!isOwnedReplayPath(auth.id, storagePath)) {
      return json(403, { error: "Invalid storage path" });
    }

    const url = await presignDownload(config, replayObjectKey(storagePath), fileName);
    return json(200, { url });
  }

  if (action === "replay-delete") {
    const storagePath = String(body.storage_path ?? "").trim();
    if (!isOwnedReplayPath(auth.id, storagePath)) {
      return json(403, { error: "Invalid storage path" });
    }

    const deleted = await deleteR2Objects(config, [replayObjectKey(storagePath)]);
    return json(200, { deleted });
  }

  // ── Mobile app APK distribution ──

  if (action === "mobile-presign-upload") {
    const adminErr = await assertAdmin(auth.client);
    if (adminErr) return adminErr;

    const productId = String(body.product_id ?? "").trim();
    if (!["video_mixer", "audio_mixer", "symphony_studio", "instant_replay"].includes(productId)) {
      return json(400, { error: "Invalid product_id" });
    }

    const mimeType = String(body.mime_type ?? "application/vnd.android.package-archive").trim()
      || "application/vnd.android.package-archive";
    const releaseId = String(body.release_id ?? crypto.randomUUID());
    const storagePath = `${productId}/${releaseId}.apk`;
    const objectKey = mobileAppObjectKey(storagePath);
    const presigned = await presignUpload(config, objectKey, mimeType);

    return json(200, {
      uploadUrl: presigned.uploadUrl,
      storagePath,
      objectKey,
      releaseId,
    });
  }

  if (action === "mobile-presign-download") {
    const releaseId = String(body.release_id ?? "").trim();
    if (!releaseId) {
      return json(400, { error: "release_id is required" });
    }

    const { data, error } = await auth.client.rpc("get_mobile_app_download", {
      p_release_id: releaseId,
    });
    if (error) {
      return json(403, { error: error.message });
    }

    const row = (data ?? {}) as Record<string, unknown>;
    const storagePath = String(row.storage_path ?? "").trim();
    const fileName = String(row.file_name ?? "app.apk").trim() || "app.apk";
    if (!isValidMobileAppStoragePath(storagePath)) {
      return json(403, { error: "Invalid storage path" });
    }

    const url = await presignDownload(config, mobileAppObjectKey(storagePath), fileName);
    return json(200, { url });
  }

  if (action === "mobile-delete") {
    const adminErr = await assertAdmin(auth.client);
    if (adminErr) return adminErr;

    const storagePath = String(body.storage_path ?? "").trim();
    if (!isValidMobileAppStoragePath(storagePath)) {
      return json(403, { error: "Invalid storage path" });
    }

    const deleted = await deleteR2Objects(config, [mobileAppObjectKey(storagePath)]);
    return json(200, { deleted });
  }

  return json(400, { error: "Unknown action" });
});
