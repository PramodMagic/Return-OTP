"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

const BATCH = 15;

export default function Home() {
  const [accessKey, setAccessKey] = useState("");
  const [columnName, setColumnName] = useState("Order ID");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");

  async function run() {
    setError("");
    setSummary("");
    if (!accessKey) return setError("Pehle Access Key daalo.");
    if (!file) return setError("Pehle Excel file chuno.");

    setBusy(true);
    try {
      setProgress("Excel padh raha hu...");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (rows.length === 0) throw new Error("Excel khaali hai.");

      const headers = Object.keys(rows[0]);
      const want = columnName.trim().toLowerCase();
      const col =
        headers.find((h) => h.trim().toLowerCase() === want) ||
        headers.find((h) => h.trim().toLowerCase().includes(want));
      if (!col) {
        throw new Error(
          `"${columnName}" naam ka column nahi mila. Aapke columns: ${headers.join(", ")}`
        );
      }

      const ids = [
        ...new Set(rows.map((r) => String(r[col]).trim()).filter((v) => v !== "")),
      ];

      const all = {};
      for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        setProgress(`Email check ho rahi hai: ${Math.min(i + BATCH, ids.length)} / ${ids.length}`);
        const res = await fetch("/api/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-access-key": accessKey },
          body: JSON.stringify({ orderIds: chunk }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Server error aaya.");
        Object.assign(all, data.results);
      }

      let ok = 0;
      const out = rows.map((r) => {
        const info = all[String(r[col]).trim()] || {};
        if (info.status === "OK") ok++;
        return {
          ...r,
          OTP: info.otp || "",
          "Total Return Qty": info.qty || "",
          "Lookup Status": info.status || "",
        };
      });

      const newWs = XLSX.utils.json_to_sheet(out);
      const newWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWb, newWs, sheetName);
      const outName = file.name.replace(/\.(xlsx|xls|csv)$/i, "") + "_with_otp.xlsx";
      XLSX.writeFile(newWb, outName);

      setSummary(`Ho gaya! ${ok} / ${ids.length} orders ka OTP mil gaya. File "${outName}" download ho gayi.`);
      setProgress("");
    } catch (e) {
      setError(e.message || "Kuch galat ho gaya.");
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  const box = {
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  };
  const input = {
    width: "100%",
    padding: 10,
    border: "1px solid #cfd5e0",
    borderRadius: 8,
    fontSize: 15,
    boxSizing: "border-box",
  };
  const label = { display: "block", fontWeight: 600, margin: "16px 0 6px" };

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: "0 16px" }}>
      <div style={box}>
        <h1 style={{ marginTop: 0, fontSize: 24 }}>OTP Excel Tool</h1>
        <p style={{ color: "#5a6478", marginTop: 0 }}>
          Excel upload karo. Tool email se OTP aur Total Return Qty nikaal kar naye columns mein bhar dega.
        </p>

        <label style={label}>Access Key</label>
        <input
          style={input}
          type="password"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
          placeholder="Vercel mein jo ACCESS_KEY rakhi thi"
        />

        <label style={label}>Order ID wale column ka naam</label>
        <input
          style={input}
          value={columnName}
          onChange={(e) => setColumnName(e.target.value)}
        />

        <label style={label}>Excel file (.xlsx / .csv)</label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button
          onClick={run}
          disabled={busy}
          style={{
            marginTop: 24,
            width: "100%",
            padding: 12,
            fontSize: 16,
            fontWeight: 600,
            color: "#fff",
            background: busy ? "#8a94a8" : "#2f5bea",
            border: "none",
            borderRadius: 8,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Kaam chal raha hai..." : "OTP nikaalo"}
        </button>

        <p style={{ marginTop: 20, fontSize: 14, color: "#5a6478" }}>
          Pehli baar use kar rahe ho?{" "}
          <a
            href={accessKey ? `/api/auth/start?key=${encodeURIComponent(accessKey)}` : "#"}
            onClick={(e) => {
              if (!accessKey) {
                e.preventDefault();
                setError("Pehle upar Access Key daalo.");
              }
            }}
          >
            Outlook connect karo
          </a>
        </p>

        {progress && <p style={{ color: "#2f5bea" }}>{progress}</p>}
        {summary && <p style={{ color: "#16803c", fontWeight: 600 }}>{summary}</p>}
        {error && <p style={{ color: "#c62828", fontWeight: 600 }}>{error}</p>}
      </div>
    </main>
  );
}
