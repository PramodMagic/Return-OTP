# OTP Excel Tool (Outlook version)

Excel upload karo -> tool aapke **Outlook** email se har Order ID ka **OTP** aur **Total Return Qty** nikaalta hai -> naye columns ke saath Excel download hoti hai.

Purani emails bhi milengi (default pichhle 60 din ki).

Poora setup lagbhag 30-40 minute ka hai. Ek-ek step dhyaan se karo. Koi step phans jaye to screen ka photo bhej dena.

---

## Step 1: Code GitHub par daalo

1. https://github.com kholo aur login karo (account nahi hai to **Sign up** karo).
2. Upar right mein **+** dabao, phir **New repository**.
3. Name likho: `otp-excel-tool`. **Private** select karo. **Create repository** dabao.
4. Zip file par right click karo, **Extract All** dabao.
5. GitHub ke naye page par **uploading an existing file** link dabao.
6. Extract hue folder ke **andar ki saari files aur folders** (`app`, `package.json`, `next.config.js`, `.gitignore`, `.env.example`, `README.md`) select karo aur page par drag karke chhodo.
7. Neeche **Commit changes** dabao.

## Step 2: Vercel par pehli baar chalao

1. https://vercel.com kholo, **Sign Up**, phir **Continue with GitHub**.
2. **Add New...** dabao, phir **Project**.
3. `otp-excel-tool` ke saamne **Import** dabao.
4. **Environment Variables** wala hissa kholo. Abhi sirf **ek** daalo:
   - Name: `ACCESS_KEY`
   - Value: koi bhi lamba secret password jo aap khud sochoge (ye yaad rakhna)
   - **Add** dabao.
5. **Deploy** dabao. 1-2 minute baad ek link milega, jaise `https://otp-excel-tool-abc.vercel.app`.
6. **Is link ko copy karke kahin likh lo.** Agle step mein chahiye.

## Step 3: Microsoft par app banao (ek baar ka kaam)

Ye Microsoft ko batata hai ki "ye tool mere mail padh sakta hai".

1. https://entra.microsoft.com kholo aur **wahi Outlook account** se login karo jisme OTP emails aati hain.
   - Agar kahe ki Azure account / credit card chahiye, **ruk jao** aur mujhe batao. Kuch aur raasta dekhenge.
2. Left menu mein **Entra ID** (ya Identity) kholo, phir **App registrations**.
3. Upar **+ New registration** dabao.
4. **Name** mein likho: `otp tool`.
5. **Supported account types** mein ye wala chuno: **Accounts in any organizational directory and personal Microsoft accounts**.
6. **Redirect URI** mein:
   - Dropdown mein **Web** chuno.
   - Dabbe mein likho: Step 2 ka link + `/api/auth/callback`
   - Example: `https://otp-excel-tool-abc.vercel.app/api/auth/callback`
7. **Register** dabao.
8. Ab jo page khule usme **Application (client) ID** dikhega (lambi line, dashes ke saath). Use copy karke likh lo. Ye hai **MS_CLIENT_ID**.

### Secret banao
9. Left menu mein **Certificates & secrets** dabao.
10. **+ New client secret** dabao, **Add** dabao.
11. Table mein **Value** naam ke column ka text **turant copy karo** aur likh lo. Ye hai **MS_CLIENT_SECRET**.
    - **Secret ID wala column mat copy karna**, wo galat hai.
    - Value baad mein dobara nahi dikhegi. Chhoot gayi to naya secret banana padega.

### Permission do
12. Left menu mein **API permissions** dabao.
13. **+ Add a permission**, phir **Microsoft Graph**, phir **Delegated permissions**.
14. Search dabbe mein `Mail.Read` likho, uske aage tick lagao, **Add permissions** dabao.
    - Office/college account ho aur "admin consent required" likha aaye, to apne IT admin se allow karwana padega.

## Step 4: Vercel mein Microsoft ki details daalo

1. Vercel kholo, apna project kholo, upar **Settings**, phir left mein **Environment Variables**.
2. Do variables daalo (har ek ke baad **Save**):
   - `MS_CLIENT_ID` = Step 3 ka Application (client) ID
   - `MS_CLIENT_SECRET` = Step 3 ka secret **Value**
3. Upar **Deployments** par jao. Sabse upar wali line ke aage **...** dabao, phir **Redeploy**, phir **Redeploy**. 1 minute ruko.

## Step 5: Outlook connect karo (ek baar ka kaam)

1. Apna Vercel link kholo.
2. **Access Key** wale dabbe mein Step 2 wali ACCESS_KEY daalo.
3. Neeche **Outlook connect karo** link dabao.
4. Microsoft ka page khulega. Outlook account chuno aur login karo.
5. "Permissions requested" aaye to **Accept** dabao.
6. Ek page khulega jisme lamba code hoga. Dabbe ke andar click karo, **Ctrl+A** dabao, phir **Ctrl+C**.
7. Vercel mein **Settings**, **Environment Variables** mein naya variable:
   - Name: `MS_REFRESH_TOKEN`
   - Value: jo abhi copy kiya (Ctrl+V)
   - **Save**.
8. Phir se **Deployments**, **...**, **Redeploy**.

Ye code kisi ko mat dikhana, isse aapki mail padhi ja sakti hai.

## Step 6: Use karo

1. Vercel link kholo.
2. **Access Key** daalo.
3. Order ID wale column ka naam likho (default `Order ID`).
4. Excel chuno aur **OTP nikaalo** dabao.
5. Kaam hone par `..._with_otp.xlsx` apne aap download hogi. Usme 3 naye columns honge: `OTP`, `Total Return Qty`, `Lookup Status`.

---

## Agar OTP/Qty nahi mil raha

Tool ko nahi pata aapki email kaisi dikhti hai, isliye ye guess karta hai:
- OTP: "OTP" ya "verification code" ke paas ka 4-8 digit number
- Qty: "Total Return Qty" / "Return Qty" ke baad ka number

`Lookup Status` mein "OTP/Qty nahi mila" aaye to ek email ka text bhej do (OTP chhupa ke bhi chalega). Main exact pattern bana dunga.

## Dhyaan rakhne wali baatein

- **Client secret ki expiry**: Microsoft secret ko max 24 mahine tak chalne deta hai. Uske baad Step 3 ke 9-11 se naya secret banao aur Vercel mein `MS_CLIENT_SECRET` badal do.
- **Refresh token**: agar 90 din tak tool ek baar bhi use na ho, ya password badlo, to Step 5 dobara karna padega.
- **Purani emails**: default 60 din. Zyada chahiye to Vercel mein `SEARCH_DAYS` = `180` jaisa daal do.
- Ek baar mein 15 orders check hote hain, baaki apne aap chalte rehte hain. Bade Excel (500+ rows) mein time lagega, page band mat karna.
