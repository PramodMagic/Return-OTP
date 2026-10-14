import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "OTP & Return Qty Matcher", description: "Match order rows with company emails" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}