export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getOrigin(req) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host && host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(title, bodyHtml, status = 200) {
  const html = `<!doctype html><html lang="hi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#1d2433">
<h2>${esc(title)}</h2>${bodyHtml}</body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(req) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (error) {
    return page("Connect nahi hua", `<p style="color:#c62828">${esc(error)}</p>`, 400);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = req.headers.get("cookie") || "";
  const saved = (cookie.match(/(?:^|;\s*)ms_state=([^;]+)/) || [])[1];
  if (!code || !state || !saved || saved !== state) {
    return page(
      "Session galat hai",
      "<p>Dobara page se <b>Outlook connect karo</b> dabao.</p>",
      400
    );
  }

  const { MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;
  const tenant = process.env.MS_TENANT || "common";
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID || "",
      client_secret: MS_CLIENT_SECRET || "",
      grant_type: "authorization_code",
      code,
      redirect_uri: `${getOrigin(req)}/api/auth/callback`,
      scope: "offline_access Mail.Read",
    }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.refresh_token) {
    const msg = (data.error_description || data.error || "Token nahi mila").split("\r\n")[0];
    return page("Connect nahi hua", `<p style="color:#c62828">${esc(msg)}</p>`, 400);
  }

  return page(
    "Outlook connect ho gaya!",
    `<p>Neeche ka lamba code poora copy karo (andar click karke Ctrl+A, phir Ctrl+C).</p>
<textarea readonly rows="8" style="width:100%;font-family:monospace;font-size:13px;box-sizing:border-box">${esc(
      data.refresh_token
    )}</textarea>
<p>Isko Vercel mein <b>MS_REFRESH_TOKEN</b> naam se save karo (README Step 5), phir Redeploy karo.</p>
<p style="color:#c62828"><b>Ye code kisi ko mat dikhana.</b> Isse aapki mail padhi ja sakti hai.</p>`
  );
}
