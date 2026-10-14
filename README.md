# OTP Excel Tool

Excel upload karo -> tool aapke email se har Order ID ka **OTP** aur **Total Return Qty** nikaalta hai -> naye columns ke saath Excel download hoti hai.

---

## Step 1: Gmail ka App Password banao

Tool ko aapke email ke andar jaane ke liye ek special password chahiye. Ye normal password nahi hota.

1. Browser mein kholo: https://myaccount.google.com/security
2. **2-Step Verification** dhundo. Agar OFF hai to use ON karo (phone se verify karna padega).
3. Ab browser mein kholo: https://myaccount.google.com/apppasswords
4. "App name" ke dabbe mein likho: `otp tool`
5. **Create** dabao.
6. Ek **16 akshar ka password** dikhega (jaise `abcd efgh ijkl mnop`). Use kahin copy karke rakh lo. Ye dobara nahi dikhega.

Gmail mein IMAP ON hona chahiye: Gmail kholo -> upar Settings (gear icon) -> **See all settings** -> **Forwarding and POP/IMAP** -> **Enable IMAP** -> **Save changes**.

## Step 2: Code GitHub par daalo

1. https://github.com par login karo (account nahi hai to Sign up karo).
2. Upar right mein **+** dabao -> **New repository**.
3. Name likho: `otp-excel-tool`. **Private** select karo. **Create repository** dabao.
4. Is zip ko computer par **Extract** karo (right click -> Extract All).
5. GitHub ke naye repository page par **uploading an existing file** link dabao.
6. Extract kiye hue folder ke **andar ki saari files aur folders** (`app`, `package.json`, `next.config.js`, `.gitignore`, `.env.example`, `README.md`) drag karke us page par daalo.
7. Neeche **Commit changes** dabao.

## Step 3: Vercel par chalao

1. https://vercel.com par jao -> **Sign Up** -> **Continue with GitHub**.
2. **Add New...** -> **Project**.
3. `otp-excel-tool` ke saamne **Import** dabao.
4. **Environment Variables** wala section kholo. Ye 4 cheezein ek-ek karke daalo (Name aur Value):

| Name | Value |
|---|---|
| `IMAP_HOST` | `imap.gmail.com` |
| `IMAP_USER` | aapka poora email |
| `IMAP_PASS` | Step 1 ka 16 akshar wala App Password (bina space ke) |
| `ACCESS_KEY` | koi bhi lamba secret password jo aap khud sochoge |

5. **Deploy** dabao. 1-2 minute baad link mil jayega (jaise `otp-excel-tool.vercel.app`).

> `ACCESS_KEY` zaroori hai. Iske bina koi bhi link khol kar aapke email se OTP nikaal sakta hai.

## Step 4: Use karo

1. Vercel ka link kholo.
2. **Access Key** daalo (Step 3 wali).
3. Order ID wale column ka naam likho (default `Order ID`).
4. Excel chuno -> **OTP nikaalo** dabao.
5. Kaam hone par `..._with_otp.xlsx` apne aap download hogi. Usme 3 naye columns honge: `OTP`, `Total Return Qty`, `Lookup Status`.

## Agar OTP/Qty nahi mil raha

Tool ko nahi pata aapki email kaisi dikhti hai, isliye wo ye guess karta hai:
- OTP: "OTP" ya "verification code" ke paas ka 4-8 digit number
- Qty: "Total Return Qty" / "Return Qty" ke baad ka number

Agar `Lookup Status` mein "OTP/Qty nahi mila" aaye, to Vercel mein `OTP_REGEX` aur `QTY_REGEX` variable daalo (details `.env.example` mein). Ya mujhe ek email ka text bhej do (OTP chhupa ke bhi chalega), main exact regex bana dunga.

## Limits

- Ek baar mein 15 orders email se check hote hain, baaki apne aap chalte rehte hain. Bahut bade Excel (500+ rows) mein thoda time lagega, page band mat karna.
- Default 60 din purane email tak dhundta hai (`SEARCH_DAYS` se badal sakte ho).
