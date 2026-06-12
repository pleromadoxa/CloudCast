import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3@3.726.1";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.726.1";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export function readR2Config(): R2Config | null {
  const accountId = (
    Deno.env.get("R2_ACCOUNT_ID") ??
    Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ??
    ""
  ).trim();
  const accessKeyId = (Deno.env.get("R2_ACCESS_KEY_ID") ?? "").trim();
  const secretAccessKey = (Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "").trim();
  const bucket = (Deno.env.get("R2_BUCKET_NAME") ?? "cloudcast-recordings").trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function isR2Configured(): boolean {
  return readR2Config() != null;
}

function createR2Client(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/** DB storage_path → R2 object key */
export function recordingObjectKey(storagePath: string): string {
  return `cloudcast/recordings/${storagePath.replace(/^\/+/, "")}`;
}

export function isOwnedRecordingPath(userId: string, storagePath: string): boolean {
  const normalized = storagePath.replace(/^\/+/, "");
  return normalized.startsWith(`${userId}/`) && !normalized.includes("..");
}

export async function presignUpload(
  config: R2Config,
  objectKey: string,
  mimeType: string,
  expiresInSec = 3600,
): Promise<{ uploadUrl: string; path: string }> {
  const client = createR2Client(config);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    ContentType: mimeType || "video/webm",
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSec });
  return { uploadUrl, path: objectKey };
}

export async function presignDownload(
  config: R2Config,
  objectKey: string,
  originalName: string,
  expiresInSec = 3600,
): Promise<string> {
  const client = createR2Client(config);
  const safeName = originalName.replace(/"/g, "");
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    ResponseContentDisposition: `attachment; filename="${safeName}"`,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSec });
}

export async function deleteR2Objects(config: R2Config, paths: string[]): Promise<number> {
  const keys = [...new Set(paths.map((p) => p.trim()).filter(Boolean))];
  if (keys.length === 0) return 0;

  const client = createR2Client(config);
  await client.send(
    new DeleteObjectsCommand({
      Bucket: config.bucket,
      Delete: {
        Objects: keys.map((Key) => ({ Key })),
        Quiet: true,
      },
    }),
  );
  return keys.length;
}
