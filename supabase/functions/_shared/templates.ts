import { appPublicUrl, legalFooterHtml, logoUrl } from "./legal.ts";

type TemplatePayload = Record<string, unknown>;

function layout(title: string, bodyHtml: string): string {
  const base = appPublicUrl();
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#060606;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e8e8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060606;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#0a0a0a;border:1px solid #222;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 16px;text-align:center;border-bottom:1px solid #1a1a1a;">
          <a href="${base}"><img src="${logoUrl()}" alt="CloudCast" width="180" style="max-width:180px;height:auto;"/></a>
        </td></tr>
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

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  pro_master: "Pro Master",
};

export function buildEmail(template: string, payload: TemplatePayload): { subject: string; html: string } {
  const base = appPublicUrl();
  const name = String(payload.full_name ?? "there");

  switch (template) {
    case "signup_welcome":
      return {
        subject: "Welcome to CloudCast",
        html: layout("Welcome to CloudCast", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#bbb;">Hi ${name},</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#bbb;">
            Your account is ready. Pair mobile cameras with a 6-digit access code, run your mixer from the dashboard, and go live to YouTube, Twitch, or custom RTMP.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#bbb;">Current plan: <strong style="color:#fff;">${PLAN_LABELS[String(payload.plan_id)] ?? "Free"}</strong></p>
          ${btn(`${base}/dashboard`, "OPEN MIXER")}
        `),
      };

    case "plan_changed":
      return {
        subject: "Your CloudCast plan was updated",
        html: layout("Plan updated", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#bbb;">Your subscription plan has changed.</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#bbb;">
            <strong style="color:#fff;">${PLAN_LABELS[String(payload.from_plan)] ?? payload.from_plan}</strong>
            →
            <strong style="color:#e11d48;">${PLAN_LABELS[String(payload.to_plan)] ?? payload.to_plan}</strong>
          </p>
          ${btn(`${base}/profile`, "VIEW ACCOUNT")}
        `),
      };

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
        html: layout(`Recording storage ${level}`, `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#bbb;">
            Your cloud recording storage is at <strong style="color:${urgent ? "#e11d48" : "#fff"};">${pct}%</strong> (${used} of ${quota}).
          </p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#bbb;">
            ${template === "storage_full"
              ? "New PGM recordings cannot be uploaded until you delete files or upgrade your plan."
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
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#bbb;">
            You have been granted <strong style="color:#fff;">${String(payload.role ?? "admin")}</strong> access to the CloudCast admin panel.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#bbb;">Use this privilege responsibly. All admin actions are logged.</p>
          ${btn(`${base}/admin`, "OPEN ADMIN")}
        `),
      };

    case "plan_grant_issued":
      return {
        subject: "Your CloudCast plan was upgraded",
        html: layout("Plan issued", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#bbb;">
            A <strong style="color:#e11d48;">${PLAN_LABELS[String(payload.plan_id)] ?? payload.plan_id}</strong> plan has been applied to your account.
          </p>
          ${payload.reason ? `<p style="margin:0 0 12px;font-size:13px;color:#888;">Note: ${String(payload.reason)}</p>` : ""}
          ${payload.expires_at ? `<p style="margin:0;font-size:13px;color:#888;">Expires: ${new Date(String(payload.expires_at)).toLocaleString()}</p>` : ""}
          ${btn(`${base}/dashboard`, "OPEN MIXER")}
        `),
      };

    case "coupon_redeemed":
      return {
        subject: "Coupon redeemed on CloudCast",
        html: layout("Coupon applied", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#bbb;">
            Code <strong style="color:#fff;font-family:monospace;">${String(payload.code)}</strong> was successfully redeemed.
          </p>
          ${payload.kind === "plan_upgrade"
            ? `<p style="margin:0;font-size:14px;color:#bbb;">Your plan is now <strong style="color:#e11d48;">${PLAN_LABELS[String(payload.plan_id)] ?? payload.plan_id}</strong>.</p>`
            : `<p style="margin:0;font-size:14px;color:#bbb;">Your discount will apply at checkout when billing launches.</p>`}
          ${btn(`${base}/profile`, "VIEW ACCOUNT")}
        `),
      };

    case "recording_uploaded":
      return {
        subject: "PGM recording saved to CloudCast",
        html: layout("Recording uploaded", `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#bbb;">
            <strong style="color:#fff;">${String(payload.file_name ?? "Recording")}</strong> (${formatBytes(Number(payload.size_bytes ?? 0))}) was saved to your cloud library.
          </p>
          ${btn(`${base}/profile`, "VIEW RECORDINGS")}
        `),
      };

    default:
      return {
        subject: "CloudCast notification",
        html: layout("Notification", `<p style="color:#bbb;font-size:14px;">You have a new notification from CloudCast.</p>`),
      };
  }
}
