export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getOrigin(req) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host && host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(req) {
  const url = new URL(req.url);
  if (
    !process.env.ACCESS_KEY ||
    url.searchParams.get("key") !== process.env.ACCESS_KEY
  ) {
    return new Response("Access key galat hai.", { status: 401 });
  }
  if (!process.env.MS_CLIENT_ID) {
    return new Response("Vercel mein MS_CLIENT_ID set nahi hai.", { status: 500 });
  }

  const tenant = process.env.MS_TENANT || "common";
  const state = crypto.randomUUID();
  const redirectUri = `${getOrigin(req)}/api/auth/callback`;

  const auth = new URL(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`
  );
  auth.searchParams.set("client_id", process.env.MS_CLIENT_ID);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_mode", "query");
  auth.searchParams.set("scope", "offline_access Mail.Read");
  auth.searchParams.set("prompt", "select_account");
  auth.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: auth.toString(),
      "Set-Cookie": `ms_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
}
