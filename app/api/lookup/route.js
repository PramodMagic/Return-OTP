export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function buildRegex(envValue, fallback) {
  if (envValue && envValue.trim()) {
    try {
      return new RegExp(envValue, "i");
    } catch (e) {
      /* galat regex ho to default use hoga */
    }
  }
  return fallback;
}

// OTP: "OTP" ya "verification code" ke aas-paas ke 4-8 digit
const DEFAULT_OTP = /(?:otp|one[\s-]*time[\s-]*password|verification\s*code|code)\D{0,40}(\d{4,8})/i;
// Qty: "Total Return Qty" / "Return Qty" / "Return Quantity" ke baad ka number
const DEFAULT_QTY =
  /(?:total\s*return\s*(?:qty|quantity)|return\s*(?:qty|quantity))\D{0,30}(\d+)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getAccessToken() {
  const { MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REFRESH_TOKEN } = process.env;
  const tenant = process.env.MS_TENANT || "common";
  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: MS_REFRESH_TOKEN,
        scope: "offline_access Mail.Read",
      }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const msg = data.error_description || data.error || "Token nahi mila";
    throw new Error(msg.split("\r\n")[0]);
  }
  return data.access_token;
}

async function graphSearch(token, orderId) {
  const q = encodeURIComponent(`"${orderId.replace(/"/g, "")}"`);
  const url =
    `https://graph.microsoft.com/v1.0/me/messages?$search=${q}` +
    `&$top=25&$select=receivedDateTime,subject,body,from`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.body-content-type="text"',
      },
      cache: "no-store",
    });
    if (res.status === 429 && attempt === 0) {
      const wait = Math.min(parseInt(res.headers.get("retry-after") || "3", 10), 10);
      await sleep(wait * 1000);
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || `Microsoft error ${res.status}`);
    }
    return data.value || [];
  }
  throw new Error("Microsoft ne thodi der rok diya, kuch der baad try karo");
}

async function processOne(token, orderId, since, otpRegex, qtyRegex) {
  const messages = await graphSearch(token, orderId);

  const from = (process.env.EMAIL_FROM || "").toLowerCase();
  const candidates = messages
    .filter((m) => new Date(m.receivedDateTime) >= since)
    .filter(
      (m) =>
        !from ||
        (m.from?.emailAddress?.address || "").toLowerCase().includes(from)
    )
    .sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime))
    .slice(0, 3);

  if (candidates.length === 0) {
    return { otp: "", qty: "", status: "Email nahi mila" };
  }

  for (const m of candidates) {
    const text = `${m.subject || ""} ${m.body?.content || ""}`
      .replace(/\s+/g, " ")
      .trim();
    // Order id sach mein email mein hona chahiye
    if (!text.includes(orderId)) continue;

    const otpMatch = text.match(otpRegex);
    const qtyMatch = text.match(qtyRegex);
    if (otpMatch || qtyMatch) {
      return {
        otp: otpMatch ? otpMatch[1] : "",
        qty: qtyMatch ? qtyMatch[1] : "",
        status: "OK",
      };
    }
  }
  return { otp: "", qty: "", status: "Email mila par OTP/Qty nahi mila" };
}

export async function POST(req) {
  const key = req.headers.get("x-access-key");
  if (!process.env.ACCESS_KEY || key !== process.env.ACCESS_KEY) {
    return Response.json({ error: "Access key galat hai." }, { status: 401 });
  }

  const { MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REFRESH_TOKEN } = process.env;
  if (!MS_CLIENT_ID || !MS_CLIENT_SECRET) {
    return Response.json(
      { error: "Vercel mein MS_CLIENT_ID aur MS_CLIENT_SECRET set nahi hain." },
      { status: 500 }
    );
  }
  if (!MS_REFRESH_TOKEN) {
    return Response.json(
      { error: "Outlook abhi connect nahi hua. Page par 'Outlook connect karo' dabao (README Step 5)." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request galat hai." }, { status: 400 });
  }
  const orderIds = Array.isArray(body.orderIds)
    ? body.orderIds.map((v) => String(v).trim()).filter(Boolean).slice(0, 40)
    : [];

  let token;
  try {
    token = await getAccessToken();
  } catch (e) {
    return Response.json(
      {
        error:
          "Outlook se connect nahi ho paya: " +
          e.message +
          " (Client secret ya refresh token check karo, ya Outlook connect dobara karo.)",
      },
      { status: 500 }
    );
  }

  const otpRegex = buildRegex(process.env.OTP_REGEX, DEFAULT_OTP);
  const qtyRegex = buildRegex(process.env.QTY_REGEX, DEFAULT_QTY);
  const days = parseInt(process.env.SEARCH_DAYS || "60", 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const results = {};
  const CONCURRENCY = 3; // Microsoft ek saath zyada requests pasand nahi karta

  for (let i = 0; i < orderIds.length; i += CONCURRENCY) {
    const group = orderIds.slice(i, i + CONCURRENCY);
    await Promise.all(
      group.map(async (orderId) => {
        try {
          results[orderId] = await processOne(token, orderId, since, otpRegex, qtyRegex);
        } catch (e) {
          results[orderId] = { otp: "", qty: "", status: "Error: " + (e.message || "unknown") };
        }
      })
    );
  }

  return Response.json({ results });
}
