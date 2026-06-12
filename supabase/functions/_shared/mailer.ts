export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; id?: string; error?: string; skipped?: boolean }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("FROM_EMAIL") ?? "CloudCast <onboarding@resend.dev>";

  if (!apiKey) {
    console.log("[email] RESEND_API_KEY not set — logging only:", input.to, input.subject);
    return { ok: true, skipped: true, id: "dev-log-only" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: JSON.stringify(data) };
  }

  return { ok: true, id: (data as { id?: string }).id };
}
