# AszureX website and Sarang licence server

Node.js + Express (`server.js`) serving static pages from `public/`. Hosted on Render, auto-deploys on push (about 2 minutes). Besides the marketing site, this server is the **only** backend for Sarang: licence keys, payments, heartbeat, usage and forms. Full money and key flow: `sarang-business-os/docs/LICENSING_AND_RENEWAL_MECHANICS.md` (Sections 9-18). Partner program: `sarang-business-os/docs/PARTNER_PROGRAM.md`.

## Run locally

```
npm install
npm start      # http://localhost:3000
```

Email and sheet features need the environment variables below; without them the routes respond but skip the missing part.

## Routes

| Route | Purpose |
|---|---|
| `POST /api/contact`, `POST /api/apply` | Contact form (incl. delivery partnership enquiries) and careers applications with resume |
| `POST /api/sarang-download` | "Get Sarang" form: issues a TRIAL key, emails key plus download link, logs the lead and any `?ref=` tag |
| `POST /api/sarang-seat-checkout` | Starts checkout for extra seats (Razorpay in India, Lemon Squeezy elsewhere) |
| `POST /api/webhooks/razorpay`, `POST /api/webhooks/lemonsqueezy` | Verified payment events: issue the PAID or seat key, email it, log partner commission |
| `POST /api/sarang-heartbeat` | Daily key-hash ping from the app; returns the kill-switch and revocation tokens |
| `POST /api/sarang-usage` | Daily anonymous usage ping |
| `POST /api/sarang-suggestion` | In-app and website suggestion box |
| `POST /api/partner-signup` | Partner application (program parked) |
| `GET /delivery-partnerships` | Clean URL for the delivery partnerships page |

## Environment variables

- Mail: `ZOHO_EMAIL`, `ZOHO_PASSWORD`, `TO_EMAIL`
- Licence signing: `SARANG_LICENSE_HMAC_SECRET` (legacy `SARANG-` keys), the Ed25519 private key variables read by `server.js` (search for `SARANG_LICENSE_ED`)
- Razorpay: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- Lemon Squeezy: `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_VARIANT_ID`, `LEMON_SQUEEZY_WEBHOOK_SECRET` (note the different spelling)
- Seats: `SARANG_SEAT_PAYMENT_LINKS_JSON`, `SARANG_SEAT_REQUEST_SHEET_WEBHOOK_URL`
- Safety valves: `SARANG_ENFORCEMENT_SUSPENDED`, `SARANG_REVOKED_KEY_HASHES`
- Google Apps Script sheet webhooks: `SARANG_LEAD_SHEET_WEBHOOK_URL`, `SARANG_USAGE_SHEET_WEBHOOK_URL`, `SARANG_DEVICE_SHEET_WEBHOOK_URL`, `SARANG_SUGGESTION_SHEET_WEBHOOK_URL`, `SARANG_COMMISSION_SHEET_WEBHOOK_URL`, `SARANG_PARTNER_SIGNUP_SHEET_WEBHOOK_URL`
- `PORT`

## Things that must stay in step with the app

- `public/sarang.html` has hardcoded version text and prices; bump it on every Sarang release and update `lastmod` in `public/sitemap.xml`.
- `public/llms.txt` and `public/robots.txt` are the AI-discoverability files; keep them consistent with what is actually live (the partner terms are still listed in `llms.txt` while the program is parked).
- The Ed25519 public key compiled into the app must match the private key on Render; rotating one without the other makes every new key fail activation.

## Contact

contact@aszurex.com
