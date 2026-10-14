import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const maxDuration = 300;

type Row = Record<string, unknown>;
type MailRecord = { text: string; subject: string; date: Date | null };

function normalize(v: unknown): string {
  return String(v ?? "").normalize("NFKC").toLowerCase().replace(/[\u200B-\u200D]/g,"").replace(/\s+/g," ").trim();
}
function escapeRegExp(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function findOtp(text: string): string {
  const patterns = [
    /(?:otp|one[\s-]*time\s*(?:password|passcode|code)|verification\s*code|security\s*code)[^\d]{0,45}(\d{4,8})/i,
    /(\d{4,8})[^\n]{0,35}(?:otp|one[\s-]*time\s*(?:password|passcode|code)|verification\s*code)/i
  ];
  for (const p of patterns) { const m=text.match(p); if(m) return m[1]; }
  return "";
}
function findReturnQty(text: string): string {
  const patterns = [
    /(?:total\s*)?(?:return(?:ed)?\s*(?:qty|quantity)|return\s*items?\s*(?:qty|quantity)|total\s*return\s*qty)\s*[:#=\-]?\s*(\d+)/i,
    /(?:qty|quantity)\s*(?:to\s*return|being\s*returned)\s*[:#=\-]?\s*(\d+)/i
  ];
  for (const p of patterns) { const m=text.match(p); if(m) return m[1]; }
  return "";
}
function hasAttribute(text: string, value: unknown): boolean {
  const v=normalize(value);
  if (!v || v.length < 3) return false;
  // Match complete-ish token boundaries to avoid e.g. order 123 matching 1234.
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(v)}($|[^a-z0-9])`,"i");
  return re.test(normalize(text));
}
function extractAttributes(row: Row, columns: string[]): string[] {
  return columns.map(c=>String(row[c] ?? "").trim()).filter(v=>v.length >= 3);
}

export async function POST(req: NextRequest) {
  let client: ImapFlow | undefined;
  try {
    const host=process.env.IMAP_HOST, user=process.env.IMAP_USER, pass=process.env.IMAP_PASS;
    if(!host || !user || !pass) return NextResponse.json({error:"IMAP config missing. Vercel Environment Variables mein IMAP_HOST, IMAP_USER aur IMAP_PASS set karein."},{status:500});
    const form=await req.formData();
    const file=form.get("file");
    if(!(file instanceof File)) return NextResponse.json({error:"Excel file upload nahi hui."},{status:400});
    if(file.size > 10*1024*1024) return NextResponse.json({error:"File 10 MB se chhoti honi chahiye."},{status:413});
    const bytes=Buffer.from(await file.arrayBuffer());
    const workbook=XLSX.read(bytes,{type:"buffer",cellDates:true});
    const sheetName=workbook.SheetNames[0];
    if(!sheetName) return NextResponse.json({error:"Excel mein koi worksheet nahi hai."},{status:400});
    const sheet=workbook.Sheets[sheetName];
    const rows=XLSX.utils.sheet_to_json<Row>(sheet,{defval:""});
    if(!rows.length) return NextResponse.json({error:"Excel mein header ke neeche koi data row nahi hai."},{status:400});
    const configured=(process.env.MATCH_COLUMNS || "Order ID,SKU,Tracking ID").split(",").map(s=>s.trim()).filter(Boolean);
    const headers=Object.keys(rows[0]);
    const matchColumns=configured.filter(c=>headers.includes(c));
    if(!matchColumns.length) return NextResponse.json({error:`MATCH_COLUMNS ke header match nahi hue. Excel headers: ${headers.join(", ")}`},{status:400});

    client=new ImapFlow({
      host, port:Number(process.env.IMAP_PORT || 993),
      secure:(process.env.IMAP_SECURE || "true").toLowerCase()==="true",
      auth:{user,pass}, logger:false, tls:{rejectUnauthorized:true}
    });
    await client.connect();
    const mailbox=process.env.IMAP_MAILBOX || "INBOX";
    const lock=await client.getMailboxLock(mailbox);
    const emails:MailRecord[]=[];
    try {
      const total=Number(client.mailbox.exists || 0);
      const max=Math.min(Math.max(Number(process.env.MAX_EMAILS || 2500),1),10000);
      const start=Math.max(1,total-max+1);
      if(total>0) {
        for await (const msg of client.fetch(`${start}:*`,{uid:true,envelope:true,source:true,internalDate:true})) {
          if(!msg.source) continue;
          const parsed=await simpleParser(msg.source);
          const body=[parsed.subject || "",parsed.text || "",typeof parsed.html==="string"?parsed.html.replace(/<[^>]*>/g," "):""].join("\n");
          emails.push({text:body,subject:parsed.subject || "",date:parsed.date || msg.internalDate || null});
        }
      }
    } finally { lock.release(); }

    let matched=0, unmatched=0;
    const output=rows.map(row=>{
      const values=extractAttributes(row,matchColumns);
      // Require at least one match, then prefer the email that matches the most configured attributes.
      let best:MailRecord|undefined, bestScore=0, tie=false;
      for(const mail of emails) {
        let score=0;
        for(const val of values) if(hasAttribute(mail.text,val)) score++;
        if(score>bestScore){best=mail;bestScore=score;tie=false;}
        else if(score>0 && score===bestScore) tie=true;
      }
      const otp=best && !tie ? findOtp(best.text) : "";
      const qty=best && !tie ? findReturnQty(best.text) : "";
      const status=!best || bestScore===0 ? "NOT_FOUND" : tie ? "AMBIGUOUS_MATCH" : (!otp || !qty) ? "MATCHED_BUT_FIELDS_MISSING" : "MATCHED";
      if(status==="MATCHED") matched++; else unmatched++;
      return {...row, OTP:otp, "Return Qty":qty, "Match Status":status};
    });
    const outBook=XLSX.utils.book_new();
    const outSheet=XLSX.utils.json_to_sheet(output);
    XLSX.utils.book_append_sheet(outBook,outSheet,sheetName.slice(0,31));
    const out=XLSX.write(outBook,{type:"buffer",bookType:"xlsx"});
    return new NextResponse(new Uint8Array(out),{
      status:200,
      headers:{
        "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":'attachment; filename="matched-orders.xlsx"',
        "Cache-Control":"no-store",
        "X-Matched-Count":String(matched),
        "X-Unmatched-Count":String(unmatched)
      }
    });
  } catch(e) {
    const message=e instanceof Error ? e.message : "Unknown server error";
    // Avoid returning connection secrets or stack traces to browser.
    return NextResponse.json({error:`Processing error: ${message.slice(0,240)}`},{status:500});
  } finally {
    if(client) { try { await client.logout(); } catch { /* connection may already be closed */ } }
  }
}