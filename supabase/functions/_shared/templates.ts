import { appPublicUrl, emailHeaderHtml, legalFooterHtml } from "./legal.ts";

type TemplatePayload = Record<string, unknown>;

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;padding:0;background:#060606;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e8e8;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#060606;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#0a0a0a;border:1px solid #222;border-radius:12px;overflow:hidden;">
        ${emailHeaderHtml()}
        <tr><td style="padding:28px 32px;">
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#fff;">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:0 32px 28px;">${legalFooterHtml()}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function btn(href: string, label: string): string {
  return `<p style="margin:24px 0 0;"><a href="${href}" style="display:inline-block;background:#e11d48;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.05em;">${label}</a></p>`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function formatDate(value: unknown): string {
  if (!value) return new Date().toLocaleDateString("en-US", { dateStyle: "long" });
  const d = new Date(String(value));
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString("en-US", { dateStyle: "long" });
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  pro_master: "Pro Master",
  universal_essential: "Universal Essential",
  universal_studio: "Universal Studio",
  universal: "Universal Master",
};

const PRODUCT_LABELS: Record<string, string> = {
  video_mixer: "Video Mixer",
  audio_mixer: "Audio Mixer",
  symphony_studio: "Symphony",
  regal_prism: "Regal Prism",
  instant_replay: "CloudCast Replay",
  universal: "CloudCast Universal",
};

function planLabel(planId: unknown): string {
  return PLAN_LABELS[String(planId)] ?? String(planId ?? "Free");
}

function productLabel(product: unknown): string {
  return PRODUCT_LABELS[String(product)] ?? String(product ?? "CloudCast");
}

function receiptTable(rows: Array<[string, string]>): string {
  const body = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1a1a1a;font-size:13px;color:#888;width:42%;">${label}</td>
          <td style="padding:10px 0;border-bottom:1px solid #1a1a1a;font-size:13px;color:#fff;text-align:right;">${value}</td>
        </tr>`,
    )
    .join("");
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0 0;border-top:1px solid #222;">
      ${body}
    </table>`;
}

export function buildEmail(template: string, payload: TemplatePayload): { subject: string; html: string } {
  const base = appPublicUrl();
  const name = String(payload.full_name ?? "there");

  switch (template) {
    case "signup_welcome":
      return {
        subject: "Welcome to CloudCast by Quantum Regal",
        html: layout("Welcome aboard", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">Hi ${name},</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">
            Your CloudCast account is ready. You now have access to the full Quantum Regal broadcast suite — live video mixing,
            instant replay, audio console, and Symphony studio — from one dashboard.
          </p>
          <ul style="margin:0 0 16px;padding-left:18px;font-size:13px;line-height:1.7;color:#999;">
            <li>Pair mobile cameras with a 6-digit access code</li>
            <li>Switch multi-cam live production from the Video Mixer</li>
            <li>Mark replay clips and push to PGM in one click</li>
            <li>Compose scores in Symphony and mix on the Audio Console</li>
          </ul>
          <p style="margin:0;font-size:14px;line-height:1.65;color:#bbb;">
            Starting plan: <strong style="color:#fff;">${planLabel(payload.plan_id)}</strong>
            · CloudCast Replay is included with Video Mixer at every tier.
          </p>
          ${btn(`${base}/products`, "OPEN PRODUCT HUB")}
        `),
      };

    case "plan_changed":
      return {
        subject: "Your CloudCast plan was updated",
        html: layout("Plan updated", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">Your CloudCast subscription has been updated.</p>
          ${payload.product ? `<p style="margin:0 0 12px;font-size:13px;color:#888;">Product: <strong style="color:#fff;">${productLabel(payload.product)}</strong></p>` : ""}
          <p style="margin:0;font-size:14px;line-height:1.65;color:#bbb;">
            <strong style="color:#fff;">${planLabel(payload.from_plan)}</strong>
            →
            <strong style="color:#e11d48;">${planLabel(payload.to_plan)}</strong>
          </p>
          ${btn(`${base}/profile`, "VIEW ACCOUNT")}
        `),
      };

    case "payment_receipt": {
      const amountCents = Number(payload.amount_cents ?? 0);
      const product = productLabel(payload.product);
      const plan = planLabel(payload.plan_id);
      const receiptId = String(payload.receipt_id ?? "—");
      const paidAt = formatDate(payload.paid_at);
      const periodEnd = payload.period_end ? formatDate(payload.period_end) : null;
      return {
        subject: `CloudCast receipt — ${product} ${plan}`,
        html: layout("Payment receipt", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">Hi ${name},</p>
          <p style="margin:0 0 4px;font-size:14px;line-height:1.65;color:#bbb;">
            Thank you for your CloudCast subscription. This email confirms your payment to Quantum Regal Digital Labs.
          </p>
          ${receiptTable([
            ["Receipt", `<span style="font-family:monospace;">${receiptId}</span>`],
            ["Date", paidAt],
            ["Product", product],
            ["Plan", plan],
            ["Amount", `<strong style="color:#e11d48;font-size:15px;">${formatMoney(amountCents, String(payload.currency ?? "USD"))}</strong>`],
            ["Billing", String(payload.billing_interval ?? "Monthly")],
            ...(periodEnd ? [["Renews", periodEnd] as [string, string]] : []),
            ["Status", `<span style="color:#22c55e;">Paid</span>`],
          ])}
          <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#666;">
            Questions about billing? Reply to this email or contact ${String(payload.support_email ?? "support@cloudcast.regal")}.
            See our <a href="${base}/legal/refunds" style="color:#e11d48;text-decoration:none;">refund policy</a>.
          </p>
          ${btn(`${base}/profile`, "VIEW BILLING")}
        `),
      };
    }

    case "storage_warning_50":
    case "storage_warning_75":
    case "storage_warning_90":
    case "storage_full": {
      const pct = Number(payload.percent_used ?? 0);
      const used = formatBytes(Number(payload.used_bytes ?? 0));
      const quota = formatBytes(Number(payload.quota_bytes ?? 0));
      const level = template === "storage_full" ? "full" : `${pct}%`;
      const urgent = template === "storage_full" || template === "storage_warning_90";
      return {
        subject: urgent
          ? `CloudCast storage ${level} — action needed`
          : `CloudCast storage at ${level}`,
        html: layout(`Cloud storage ${level}`, `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">
            Your Regal Cloud storage (PGM recordings + replay clips) is at
            <strong style="color:${urgent ? "#e11d48" : "#fff"};">${pct}%</strong> (${used} of ${quota}).
          </p>
          <p style="margin:0;font-size:14px;line-height:1.65;color:#bbb;">
            ${template === "storage_full"
              ? "New uploads are blocked until you delete files or upgrade your Video Mixer plan."
              : "Consider removing old recordings or upgrading for more cloud storage."}
          </p>
          ${btn(`${base}/profile`, "MANAGE STORAGE")}
        `),
      };
    }

    case "admin_access_granted":
      return {
        subject: "CloudCast admin access granted",
        html: layout("Admin access granted", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">
            You have been granted <strong style="color:#fff;">${String(payload.role ?? "admin")}</strong> access to the CloudCast admin panel.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.65;color:#bbb;">Use this privilege responsibly. All admin actions are logged.</p>
          ${btn(`${base}/admin`, "OPEN ADMIN")}
        `),
      };

    case "plan_grant_issued":
      return {
        subject: "Your CloudCast plan was upgraded",
        html: layout("Plan issued", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">
            A <strong style="color:#e11d48;">${planLabel(payload.plan_id)}</strong> plan has been applied to your account
            ${payload.product ? ` for <strong style="color:#fff;">${productLabel(payload.product)}</strong>` : ""}.
          </p>
          ${payload.reason ? `<p style="margin:0 0 12px;font-size:13px;color:#888;">Note: ${String(payload.reason)}</p>` : ""}
          ${payload.expires_at ? `<p style="margin:0;font-size:13px;color:#888;">Expires: ${new Date(String(payload.expires_at)).toLocaleString()}</p>` : ""}
          ${btn(`${base}/products`, "OPEN PRODUCT HUB")}
        `),
      };

    case "coupon_redeemed":
      return {
        subject: "Coupon redeemed on CloudCast",
        html: layout("Coupon applied", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">
            Code <strong style="color:#fff;font-family:monospace;">${String(payload.code)}</strong> was successfully redeemed.
          </p>
          ${payload.kind === "plan_upgrade"
            ? `<p style="margin:0;font-size:14px;color:#bbb;">Your plan is now <strong style="color:#e11d48;">${planLabel(payload.plan_id)}</strong>.</p>`
            : `<p style="margin:0;font-size:14px;color:#bbb;">Your discount will apply at checkout when billing launches.</p>`}
          ${btn(`${base}/profile`, "VIEW ACCOUNT")}
        `),
      };

    case "recording_uploaded":
      return {
        subject: "PGM recording saved to Regal Cloud",
        html: layout("Recording uploaded", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">
            <strong style="color:#fff;">${String(payload.file_name ?? "Recording")}</strong>
            (${formatBytes(Number(payload.size_bytes ?? 0))}) was saved to your Regal Cloud library.
          </p>
          ${btn(`${base}/profile`, "VIEW RECORDINGS")}
        `),
      };

    case "replay_clip_uploaded":
      return {
        subject: "Replay clip saved to Regal Cloud",
        html: layout("Replay clip saved", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">
            Your replay clip <strong style="color:#fff;">${String(payload.label ?? payload.file_name ?? "Clip")}</strong>
            (${formatBytes(Number(payload.size_bytes ?? 0))}) was synced to Regal Cloud.
          </p>
          ${btn(`${base}/replay`, "OPEN REPLAY")}
        `),
      };

    case "replay_ops_digest": {
      const snapshotCount = Number(payload.snapshot_count_7d ?? 0);
      const auditCount = Number(payload.audit_count_7d ?? 0);
      const operator = String(payload.latest_operator ?? "—");
      const houseClock = String(payload.latest_house_clock ?? "—");
      const bufferSec = Number(payload.latest_buffer_seconds ?? 0);
      const recentAudit = Array.isArray(payload.recent_audit) ? payload.recent_audit : [];
      const auditLines = recentAudit
        .slice(0, 5)
        .map((row: Record<string, unknown>) =>
          `<li style="margin:0 0 6px;color:#bbb;font-size:13px;">${String(row.event_type ?? "event")} · ${String(row.label ?? "—")}</li>`
        )
        .join("");
      return {
        subject: "CloudCast Replay ops digest",
        html: layout("Replay ops digest", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">
            Last 7 days: <strong style="color:#fff;">${snapshotCount}</strong> buffer snapshots,
            <strong style="color:#fff;">${auditCount}</strong> audit events.
          </p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">
            Latest ops snapshot: ${operator} · house ${houseClock} · buffer ${bufferSec.toFixed(1)}s
          </p>
          ${auditLines ? `<ul style="margin:0 0 12px;padding-left:18px;">${auditLines}</ul>` : ""}
          ${btn(`${base}/replay`, "OPEN REPLAY")}
        `),
      };
    }

    case "audio_ops_digest": {
      const snapshotCount = Number(payload.snapshot_count_7d ?? 0);
      const auditCount = Number(payload.audit_count_7d ?? 0);
      const operator = String(payload.latest_operator ?? "—");
      const masterVol = Number(payload.latest_master_volume ?? 0);
      const scene = String(payload.latest_scene ?? "—");
      const recentAudit = Array.isArray(payload.recent_audit) ? payload.recent_audit : [];
      const auditLines = recentAudit
        .slice(0, 5)
        .map((row: Record<string, unknown>) =>
          `<li style="margin:0 0 6px;color:#bbb;font-size:13px;">${String(row.event_type ?? "event")} · ${String(row.label ?? row.scene_id ?? "—")}</li>`
        )
        .join("");
      return {
        subject: "CloudCast Audio Mixer ops digest",
        html: layout("Audio ops digest", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">
            Last 7 days: <strong style="color:#fff;">${snapshotCount}</strong> console snapshots,
            <strong style="color:#fff;">${auditCount}</strong> audit events.
          </p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">
            Latest: ${operator} · master ${masterVol}% · scene ${scene}
          </p>
          ${auditLines ? `<ul style="margin:0 0 12px;padding-left:18px;">${auditLines}</ul>` : ""}
          ${btn(`${base}/audio`, "OPEN AUDIO MIXER")}
        `),
      };
    }

    default:
      return {
        subject: "CloudCast by Quantum Regal",
        html: layout("Notification", `<p style="color:#bbb;font-size:14px;line-height:1.65;">You have a new notification from CloudCast.</p>`),
      };
  }
}

/** Sample payloads for preview generation and admin testing. */
export const EMAIL_TEMPLATE_SAMPLES: Record<string, TemplatePayload> = {
  signup_welcome: { full_name: "Alex Rivera", plan_id: "free" },
  plan_changed: { full_name: "Alex Rivera", product: "video_mixer", from_plan: "free", to_plan: "pro" },
  payment_receipt: {
    full_name: "Alex Rivera",
    receipt_id: "CC-2025-0612-A1B2C3D4",
    product: "video_mixer",
    plan_id: "pro",
    amount_cents: 2900,
    currency: "USD",
    billing_interval: "Monthly",
    paid_at: new Date().toISOString(),
    period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
  },
  storage_warning_75: { used_bytes: 40e9, quota_bytes: 50e9, percent_used: 80 },
  admin_access_granted: { role: "admin" },
  plan_grant_issued: { plan_id: "pro_master", product: "video_mixer", reason: "Launch partner" },
  coupon_redeemed: { code: "REGAL30", kind: "plan_upgrade", plan_id: "pro" },
  recording_uploaded: { file_name: "Sunday Service PGM.mp4", size_bytes: 1_200_000_000 },
  replay_clip_uploaded: { label: "Touchdown — Q3", size_bytes: 45_000_000 },
  replay_ops_digest: {
    snapshot_count_7d: 12,
    audit_count_7d: 48,
    latest_operator: "Director A",
    latest_house_clock: "01:14:22:08",
    latest_buffer_seconds: 42.5,
    recent_audit: [{ event_type: "mark_in", label: "01:14:20:00" }],
  },
  audio_ops_digest: {
    snapshot_count_7d: 8,
    audit_count_7d: 32,
    latest_operator: "A1 Engineer",
    latest_master_volume: 78,
    latest_scene: "B",
    recent_audit: [{ event_type: "scene_recall", scene_id: "B" }],
  },
};

export const EMAIL_TEMPLATE_IDS = Object.keys(EMAIL_TEMPLATE_SAMPLES);
