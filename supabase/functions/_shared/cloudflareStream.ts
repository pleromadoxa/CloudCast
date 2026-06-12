export type StreamPlanTier = "pro" | "pro_master";

export interface CloudflareStreamConfig {
  accountId: string;
  apiToken: string;
}

export interface LiveInputEndpoints {
  uid: string;
  whipUrl: string;
  whepUrl: string;
}

export function readCloudflareStreamConfig(): CloudflareStreamConfig | null {
  const accountId = (
    Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ??
    Deno.env.get("R2_ACCOUNT_ID") ??
    ""
  ).trim();
  const apiToken = (Deno.env.get("CLOUDFLARE_API_TOKEN") ?? "").trim();
  if (!accountId || !apiToken) return null;
  return { accountId, apiToken };
}

function apiBase(accountId: string) {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`;
}

export async function createLiveInput(
  config: CloudflareStreamConfig,
  meta: Record<string, string>,
  planId: StreamPlanTier,
): Promise<LiveInputEndpoints> {
  const res = await fetch(`${apiBase(config.accountId)}/live_inputs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      meta: {
        ...meta,
        plan_id: planId,
        product: "cloudcast",
      },
      recording: { mode: "off" },
      deleteRecordingAfterDays: null,
    }),
  });

  const payload = await res.json();
  if (!payload.success) {
    const msg = payload.errors?.[0]?.message ?? "Failed to create live input";
    throw new Error(msg);
  }

  return parseLiveInputResult(payload.result);
}

export async function getLiveInput(
  config: CloudflareStreamConfig,
  uid: string,
): Promise<LiveInputEndpoints | null> {
  const res = await fetch(`${apiBase(config.accountId)}/live_inputs/${uid}`, {
    headers: { Authorization: `Bearer ${config.apiToken}` },
  });
  const payload = await res.json();
  if (!payload.success) return null;
  return parseLiveInputResult(payload.result);
}

export async function deleteLiveInput(
  config: CloudflareStreamConfig,
  uid: string,
): Promise<void> {
  await fetch(`${apiBase(config.accountId)}/live_inputs/${uid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${config.apiToken}` },
  });
}

function parseLiveInputResult(result: Record<string, unknown>): LiveInputEndpoints {
  const uid = String(result.uid ?? "");
  const whipUrl = String((result.webRTC as Record<string, unknown> | undefined)?.url ?? "");
  const whepUrl = String((result.webRTCPlayback as Record<string, unknown> | undefined)?.url ?? "");
  if (!uid || !whipUrl || !whepUrl) {
    throw new Error("Live input response missing WebRTC endpoints");
  }
  return { uid, whipUrl, whepUrl };
}
