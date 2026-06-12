export function appPublicUrl(): string {
  return (Deno.env.get("APP_PUBLIC_URL") ?? "https://cloudcast.regal").replace(/\/$/, "");
}

export function logoUrl(): string {
  return `${appPublicUrl()}/email/cloudcast-logo.png`;
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
      CloudCast by Quantum Regal · Professional multi-source video mixing<br/>
      Quantum Regal Digital Labs · legal@cloudcast.regal · support@cloudcast.regal
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
