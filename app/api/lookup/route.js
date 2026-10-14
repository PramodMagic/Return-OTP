import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

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

function cleanText(parsed) {
  let text = parsed.text || "";
  if (!text && parsed.html) {
    text = String(parsed.html)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ");
  }
  return text.replace(/\s+/g, " ").trim();
}

export async function POST(req) {
  const key = req.headers.get("x-access-key");
  if (!process.env.ACCESS_KEY || key !== process.env.ACCESS_KEY) {
    return Response.json({ error: "Access key galat hai." }, { status: 401 });
  }

  const { IMAP_HOST, IMAP_USER, IMAP_PASS } = process.env;
  if (!IMAP_HOST || !IMAP_USER || !IMAP_PASS) {
    return Response.json(
      { error: "Vercel mein IMAP_HOST, IMAP_USER, IMAP_PASS set nahi hain." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request galat hai." }, { status: 400 });
  }
  const orderIds = Array.isArray(body.orderIds) ? body.orderIds.slice(0, 40) : [];

  const otpRegex = buildRegex(process.env.OTP_REGEX, DEFAULT_OTP);
  const qtyRegex = buildRegex(process.env.QTY_REGEX, DEFAULT_QTY);
  const days = parseInt(process.env.SEARCH_DAYS || "60", 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false,
  });

  const results = {};

  try {
    await client.connect();
  } catch (e) {
    return Response.json(
      { error: "Email se connect nahi ho paya. App Password aur IMAP settings check karo." },
      { status: 500 }
    );
  }

  const lock = await client.getMailboxLock(process.env.IMAP_MAILBOX || "INBOX");
  try {
    for (const rawId of orderIds) {
      const orderId = String(rawId).trim();
      if (!orderId) continue;

      try {
        const query = { body: orderId, since };
        if (process.env.EMAIL_FROM) query.from = process.env.EMAIL_FROM;

        const uids = await client.search(query, { uid: true });
        if (!uids || uids.length === 0) {
          results[orderId] = { otp: "", qty: "", status: "Email nahi mila" };
          continue;
        }

        // Sabse naye 3 email dekhenge
        const latest = [...uids].sort((a, b) => b - a).slice(0, 3);
        let found = null;

        for (const uid of latest) {
          const msg = await client.fetchOne(uid, { source: true }, { uid: true });
          if (!msg || !msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const text = cleanText(parsed);
          // Order id sach mein email mein hona chahiye
          if (!text.includes(orderId)) continue;

          const otpMatch = text.match(otpRegex);
          const qtyMatch = text.match(qtyRegex);
          if (otpMatch || qtyMatch) {
            found = {
              otp: otpMatch ? otpMatch[1] : "",
              qty: qtyMatch ? qtyMatch[1] : "",
              status: "OK",
            };
            break;
          }
        }

        results[orderId] =
          found || { otp: "", qty: "", status: "Email mila par OTP/Qty nahi mila" };
      } catch (e) {
        results[orderId] = { otp: "", qty: "", status: "Error: " + (e.message || "unknown") };
      }
    }
  } finally {
    lock.release();
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }

  return Response.json({ results });
}
