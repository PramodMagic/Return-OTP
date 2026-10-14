 "use client";
import { useState } from "react";
export default function Home() {
  const [file,setFile] = useState<File|null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setMessage("Pehle Excel file select karein."); setError(true); return; }
    setBusy(true); setMessage("Excel aur mailbox process ho rahe hain. Bade inbox mein kuch samay lag sakta hai."); setError(false);
    try {
      const fd = new FormData(); fd.append("file",file);
      const res = await fetch("/api/process",{method:"POST",body:fd});
      if (!res.ok) {
        const data = await res.json().catch(()=>({error:"Processing failed"}));
        throw new Error(data.error || "Processing failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href=url; a.download=match?.[1] || "matched-orders.xlsx";
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      const matched = res.headers.get("x-matched-count") || "?";
      const unmatched = res.headers.get("x-unmatched-count") || "?";
      setMessage(`Complete. Matched rows: ${matched}. Unmatched rows: ${unmatched}. Updated Excel download ho gayi.`);
    } catch(err) { setError(true); setMessage(err instanceof Error ? err.message : "Unknown error"); }
    finally { setBusy(false); }
  }
  return <main className="wrap"><section className="panel">
    <h1>OTP & Return Quantity Matcher</h1>
    <p className="muted">Excel upload karein. Tool company inbox ke emails ko configured order attributes se match karega, phir OTP, Return Qty aur Status columns ke saath updated Excel download karega.</p>
    <form onSubmit={submit}>
      <div className="drop"><strong>Excel file select karein (.xlsx / .xls)</strong><input type="file" accept=".xlsx,.xls" onChange={e=>setFile(e.target.files?.[0]||null)} /></div>
      <button disabled={busy}>{busy ? "Processing..." : "Match Emails & Download Excel"}</button>
    </form>
    {message && <div className={"notice"+(error?" error":"")}>{message}</div>}
    <h2>Excel headers</h2>
    <p className="muted">Default configuration mein <code>Order ID</code>, <code>SKU</code> aur <code>Tracking ID</code> matching columns hain. Apni file ke exact header names ko Vercel Environment Variables mein <code>MATCH_COLUMNS</code> ke andar set karein.</p>
    <h2>Output columns</h2><p><code>OTP</code>, <code>Return Qty</code>, <code>Match Status</code></p>
    <p className="muted small">OTP aur mailbox content sensitive hain. Tool email body ya credentials ko database mein save nahi karta. Access ko apne trusted users tak restrict karein; public link share na karein.</p>
  </section></main>;
}