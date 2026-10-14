# OTP & Return Quantity Matcher (starter)

Next.js app for uploading an Excel workbook, checking a company mailbox over IMAP, matching configured attributes, and downloading a new workbook with `OTP`, `Return Qty`, and `Match Status`.

## Important before production
- Confirm your company email provider permits IMAP access and that your account is allowed to use it. Some corporate providers require an app password, OAuth2, VPN, IP allowlisting, or administrator approval.
- This starter scans a limited number of recent messages from one mailbox. It does not yet handle shared mailboxes, attachments/PDF extraction, multiple folders, or every possible email template.
- OTP and quantity extraction uses configurable-style regex patterns in `app/api/process/route.ts`; adjust these to the actual email wording.
- Matching logic should be tested against representative emails and spreadsheets before relying on results. Rows marked `AMBIGUOUS_MATCH` or `MATCHED_BUT_FIELDS_MISSING` require review.
- Do not use this to bypass access controls or retrieve codes from a mailbox you are not authorized to access.
- No uploaded spreadsheet or email contents are intentionally stored in a database. The generated file is returned directly to the browser.
- For 500–2,000 rows, processing can be slow depending on inbox size. Vercel function duration and network access vary by plan/configuration. If runs time out, use a queue/background worker on a service designed for long-running IMAP jobs.

## Run locally
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local` and fill in the mailbox details.
3. Set `MATCH_COLUMNS` to exact column headings from your Excel file, comma-separated.
4. Run:
   ```bash
   npm install
   npm run dev
   ```
5. Open http://localhost:3000.

## Deploy with GitHub + Vercel
1. Create a new private GitHub repository.
2. Upload the project files. Do not upload `.env.local` or any mailbox credentials.
3. In Vercel, import the repository.
4. In Vercel Project Settings → Environment Variables, add `IMAP_HOST`, `IMAP_PORT`, `IMAP_SECURE`, `IMAP_USER`, `IMAP_PASS`, `IMAP_MAILBOX`, `MATCH_COLUMNS`, and `MAX_EMAILS`.
5. Deploy and test with a small, non-sensitive sample workbook first.
6. Redeploy after changing environment variables.

## Excel requirements
- The first worksheet is processed.
- The first row must contain headers.
- `MATCH_COLUMNS` values must exactly match Excel header names.
- Existing columns are preserved; output columns are appended/overwritten.
- Input file limit: 10 MB.

## Security checklist
- Keep the Vercel project private to your organization where possible.
- Add authentication before sharing the tool with other users. This starter does not implement user login, so do not publish a publicly accessible URL containing mailbox access.
- Use an app-specific password or OAuth2 if required by your provider; use least-privilege mailbox access.
- Never commit credentials to GitHub.
- Consider limiting access by company SSO/VPN and add rate limiting before production.
