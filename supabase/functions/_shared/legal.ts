function envGet(key: string): string | undefined {
  if (typeof Deno !== "undefined") {
    return Deno.env.get(key);
  }
  return undefined;
}

export function appPublicUrl(): string {
  return (envGet("APP_PUBLIC_URL") ?? "https://cloudcast.regal").replace(/\/$/, "");
}

export function logoUrl(): string {
  return `${appPublicUrl()}/email/cloudcast-logo.png`;
}

export const EMAIL_BRAND = {
  productName: "CloudCast",
  byline: "by Quantum Regal",
  companyName: "Quantum Regal Digital Labs",
  tagline: "Professional broadcast production platform",
  supportEmail: "support@cloudcast.regal",
  legalEmail: "legal@cloudcast.regal",
} as const;

/** Branded email header — logo + Regal byline on every template. */
export function emailHeaderHtml(): string {
  const base = appPublicUrl();
  return `
    <tr>
      <td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #1a1a1a;background:linear-gradient(180deg,#0f0f0f 0%,#0a0a0a 100%);">
        <a href="${base}" style="text-decoration:none;display:inline-block;">
          <img src="${logoUrl()}" alt="${EMAIL_BRAND.productName} ${EMAIL_BRAND.byline}" width="200" height="auto" style="max-width:200px;height:auto;display:block;margin:0 auto 12px;border:0;"/>
          <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#e11d48;">${EMAIL_BRAND.byline}</p>
          <p style="margin:6px 0 0;font-size:11px;color:#666;letter-spacing:0.04em;">${EMAIL_BRAND.tagline}</p>
        </a>
      </td>
    </tr>`;
}

export function legalFooterHtml(): string {
  const base = appPublicUrl();
  const links = [
    { href: `${base}/legal/terms`, label: "Terms of Service" },
    { href: `${base}/legal/privacy`, label: "Privacy Policy" },
    { href: `${base}/legal/cookies`, label: "Cookie Policy" },
    { href: `${base}/legal/acceptable-use`, label: "Acceptable Use" },
    { href: `${base}/legal/security`, label: "Security" },
    { href: `${base}/legal/refunds`, label: "Refunds" },
  ];
  return `
    <p style="margin:24px 0 8px;font-size:11px;color:#888;line-height:1.6;">
      ${EMAIL_BRAND.productName} ${EMAIL_BRAND.byline}<br/>
      ${EMAIL_BRAND.companyName} · ${EMAIL_BRAND.legalEmail} · ${EMAIL_BRAND.supportEmail}
    </p>
    <p style="margin:0;font-size:11px;color:#666;line-height:1.8;">
      ${links.map((l) => `<a href="${l.href}" style="color:#e11d48;text-decoration:none;margin-right:12px;">${l.label}</a>`).join("")}
    </p>
    <p style="margin:12px 0 0;font-size:10px;color:#555;">
      You received this transactional email because of activity on your CloudCast account.
      Manage notifications in your <a href="${base}/profile" style="color:#e11d48;">profile dashboard</a>.
    </p>
  `;
}
