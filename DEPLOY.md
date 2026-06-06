# Deploy + email setup

## 1. Set environment variables in Netlify

Open your site in the Netlify dashboard → **Site configuration → Environment variables → Add a variable**, and add all three:

| Key            | Value                                                |
| -------------- | ---------------------------------------------------- |
| `USER_NAME`    | Your Gmail address (e.g. `you@gmail.com`)            |
| `APP_PASSWORD` | The 16-char Gmail App Password (no spaces)           |
| `SENDTO`       | Where leads should land (e.g. `hfxsourcing@gmail.com`) |

> **Gmail app password reminder:** these only work when 2FA is on. Generate at https://myaccount.google.com/apppasswords. Use the 16-char string with NO spaces.

After adding, redeploy the site so the function picks them up.

---

## 2. Deploy the site (drag-and-drop won't work as-is)

Drag-and-drop deploys do **not** run `npm install`, so the function has no `nodemailer` to load. Pick one:

### Option A — Netlify CLI (recommended, ~2 minutes one-time setup)

```bash
# one-time
npm install -g netlify-cli
cd "C:\Users\USER-PC\Downloads\Gaurav Ads Landing"
npm install
netlify login
netlify link     # pick your existing site

# every deploy
netlify deploy --prod
```

The CLI bundles the function with its dependencies automatically.

### Option B — Drag-and-drop, but include `node_modules`

```bash
cd "C:\Users\USER-PC\Downloads\Gaurav Ads Landing"
npm install
```

Then drag the entire folder (including `node_modules/`, `netlify/`, `package.json`, `netlify.toml`) into Netlify's deploy UI. Bigger upload, but works.

### Option C — Connect a Git repo (best for ongoing work)

Push this folder to GitHub, connect the repo in Netlify, and let Netlify run `npm install` on each deploy automatically. No commands to remember.

---

## 3. Confirm the homepage filename

The form POSTs to `/.netlify/functions/submit-form` — that path is independent of the HTML filename, so you're fine.

But the HTML file is currently named `mortgage-with-garry.html`. For it to load at the root URL (`gaurav-mortgage-ads-landing.netlify.app/`), rename it to `index.html` before deploying, OR add this to `netlify.toml`:

```toml
[[redirects]]
  from = "/"
  to = "/mortgage-with-garry.html"
  status = 200
```

---

## 4. Test

1. Visit the deployed site.
2. Fill the form and click **Get My Free Consultation**.
3. Within ~10 seconds you should see the success state. Check the `SENDTO` inbox for the lead email.
4. If it errors, open the browser console + Netlify **Functions** logs (Site → Logs → Functions → `submit-form`).

---

## What this stack does

- **`netlify/functions/submit-form.mjs`** — serverless endpoint that validates the payload (incl. honeypot), opens an SMTP connection to `smtp.gmail.com:465`, and sends a formatted lead email.
- **`mortgage-with-garry.html`** — `handleSubmit()` now does a `fetch` POST with the form fields and shows the success state only after the email actually sends.
- **`package.json`** — declares `nodemailer`.
- **`netlify.toml`** — tells Netlify where functions live and to bundle with esbuild.

## Worth knowing

- **Gmail SMTP cap is ~500 sends/day.** Fine for a landing page, will break at scale. If volume grows, swap to Resend/SendGrid (change ~10 lines in `submit-form.mjs`).
- **Reply-to is set to the lead's email**, so hitting "Reply" in your inbox emails the prospect directly.
- **Tighten CORS:** in `submit-form.mjs`, change `ALLOWED_ORIGIN` from `"*"` to your exact Netlify URL once you're sure everything works.
- **Spam: low risk now, real risk later.** No CAPTCHA on the form. Honeypot will stop dumb bots; if you start getting junk, add Cloudflare Turnstile or hCaptcha.
