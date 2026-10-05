const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { createHmac, timingSafeEqual, randomBytes, sign: cryptoSign } = require('crypto');

// ── Env-var check ─────────────────────────────────────────
const ZOHO_EMAIL    = process.env.ZOHO_EMAIL;
const ZOHO_PASSWORD = process.env.ZOHO_PASSWORD;
const TO_EMAIL      = process.env.TO_EMAIL;

if (!ZOHO_EMAIL || !ZOHO_PASSWORD || !TO_EMAIL) {
  console.error('❌ MISSING ENV VARS:', {
    ZOHO_EMAIL:    !!ZOHO_EMAIL,
    ZOHO_PASSWORD: !!ZOHO_PASSWORD,
    TO_EMAIL:      !!TO_EMAIL
  });
}

// ── Phase 59 — Sarang licensing env vars ───────────────────
// SARANG_LICENSE_HMAC_SECRET MUST be the exact same value set at build time
// on the Sarang app side (see sarang-business-os/src/main/services/license.service.ts's
// LICENSE_HMAC_SECRET) — this is what lets the app verify a key this server
// issues. Generate a strong random value once (e.g. `openssl rand -hex 32`)
// and set it identically in both places; never commit the real value to git.
const SARANG_LICENSE_HMAC_SECRET = process.env.SARANG_LICENSE_HMAC_SECRET || '';
// Optional — a Google Apps Script Web App URL (see PHASE_59 doc, 59.1) that
// appends a row to a Google Sheet. Lead capture still works (emails still
// send) without this set; it just means submissions aren't also logged to
// a durable, queryable list yet.
const SARANG_LEAD_SHEET_WEBHOOK_URL = process.env.SARANG_LEAD_SHEET_WEBHOOK_URL || '';
// Google Apps Script Web App URL for the separate, dedicated usage-metrics
// sheet (aggregate anonymous daily active-usage tracking). Unlike the lead
// sheet above, this one is NOT optional at the route level — the client
// depends on a genuine success response to know it's safe to clear its
// local queue, so if this isn't configured the route fails closed (503)
// rather than pretending to have recorded something it didn't.
const SARANG_USAGE_SHEET_WEBHOOK_URL = process.env.SARANG_USAGE_SHEET_WEBHOOK_URL || '';
// Google Apps Script Web App URL for the device-activation visibility sheet
// (2026-09-02) — logs {keyHash, fingerprintHash} on every heartbeat so a
// key activated on an unusual number of distinct devices is visible for
// manual review. Optional, same "still works without it" reasoning as the
// lead sheet above: the heartbeat's real job (returning the kill-switch
// token) must never be delayed or blocked by this logging.
const SARANG_DEVICE_SHEET_WEBHOOK_URL = process.env.SARANG_DEVICE_SHEET_WEBHOOK_URL || '';
// Google Apps Script Web App URL for the Sarang suggestion-box sheet
// (2026-09-15) — same "still works without it" reasoning as the lead sheet
// above: the suggestion email still sends regardless, this just also logs
// submissions to a durable, queryable list.
const SARANG_SUGGESTION_SHEET_WEBHOOK_URL = process.env.SARANG_SUGGESTION_SHEET_WEBHOOK_URL || '';
// Google Apps Script Web App URL for the Sarang partner-signup sheet (U7, 2026-09-29) — same
// "still works without it" reasoning as the other sheets: the notification email still sends
// regardless, this just also logs applications to a durable, queryable list for review.
const SARANG_PARTNER_SIGNUP_SHEET_WEBHOOK_URL = process.env.SARANG_PARTNER_SIGNUP_SHEET_WEBHOOK_URL || '';
// Google Apps Script Web App URL for the Sarang add-seats request sheet (U5, 2026-09-29) —
// same "still works without it" reasoning as the other sheets: the notification email to
// AszureX still sends regardless, this just also logs requests to a durable, queryable list.
const SARANG_SEAT_REQUEST_SHEET_WEBHOOK_URL = process.env.SARANG_SEAT_REQUEST_SHEET_WEBHOOK_URL || '';
// Optional per-seat-count static Payment Link lookup (U5) — once real Razorpay Payment Links
// and Lemon Squeezy checkout URLs are created for specific seat tiers, set this to JSON like
// {"2":{"IN":"https://rzp.io/...","INTL":"https://aszurex.lemonsqueezy.com/checkout/buy/..."}}
// and matching requests are sent straight to checkout instead of the email-request fallback.
let SARANG_SEAT_PAYMENT_LINKS = {};
try { SARANG_SEAT_PAYMENT_LINKS = JSON.parse(process.env.SARANG_SEAT_PAYMENT_LINKS_JSON || '{}'); }
catch { console.error('❌ SARANG_SEAT_PAYMENT_LINKS_JSON is not valid JSON — ignoring it, falling back to email requests for all seat counts.'); }
// Fail closed (2026-09-30, founder's explicit decision) — matches the RAZORPAY_WEBHOOK_SECRET/
// LEMON_SQUEEZY_WEBHOOK_SECRET "refuse to run insecure" posture below. This secret signs every
// SARANG-format license key, kill-switch token, and revocation token this server issues; running
// on the old hardcoded placeholder meant anyone who read this file (or the public GitHub repo's
// history) could forge a valid-looking license key offline. No NODE_ENV/dev-mode distinction
// exists anywhere else in this file, so this doesn't invent one — it fails closed unconditionally,
// the same as production would. For real local dev, set a throwaway value in a local .env instead.
if (!SARANG_LICENSE_HMAC_SECRET) {
  console.error('❌ FATAL: SARANG_LICENSE_HMAC_SECRET not set. Refusing to start rather than run on an insecure placeholder.');
  process.exit(1);
}
// Set once the founder's Razorpay/Lemon Squeezy accounts are approved —
// found in each provider's dashboard under Webhooks. Until set, the
// corresponding webhook route below rejects everything (fails closed, not
// open — see the checks inside each handler).
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const LEMON_SQUEEZY_WEBHOOK_SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || '';

// ── Payment-provider webhook-adapter ceiling (2026-09-30) ──
// Every new payment provider needs its own hand-written webhook route here (signature
// verification, event-shape parsing, the works) — that's fine for a couple of providers, but it
// doesn't scale as a strategy. List every known webhook-secret env var name here (add to this
// array, not just a new `const`, whenever a new provider is wired up) so this check actually sees
// it. If more than 5 are ever configured at once, refuse to start: past that point, a real
// checkout-API integration (one that handles many payment methods/providers itself) should
// replace another hand-made Payment Link adapter, not extend this list further.
const SARANG_WEBHOOK_SECRET_ENV_VARS = ['RAZORPAY_WEBHOOK_SECRET', 'LEMON_SQUEEZY_WEBHOOK_SECRET'];
const SARANG_WEBHOOK_SECRET_CEILING = 5;
const configuredWebhookSecretCount = SARANG_WEBHOOK_SECRET_ENV_VARS.filter(name => !!process.env[name]).length;
if (configuredWebhookSecretCount > SARANG_WEBHOOK_SECRET_CEILING) {
  console.error(
    `❌ FATAL: ${configuredWebhookSecretCount} payment-provider webhook secrets are configured ` +
    `(ceiling is ${SARANG_WEBHOOK_SECRET_CEILING}). This is a deliberate limit, not an oversight — ` +
    `past ${SARANG_WEBHOOK_SECRET_CEILING} manually-managed payment-provider webhook adapters, a real ` +
    `checkout-API integration should replace hand-made Payment Links, not one more adapter bolted onto ` +
    `this file. Refusing to start.`
  );
  process.exit(1);
}
// 2026-09-02 — Ed25519 private key for SARANG2 keys, base64-wrapped PKCS8 PEM
// (avoids Render env-UI newline mangling). Never the same value as anything
// shipped client-side. Decoded once at startup.
const SARANG_LICENSE_ED25519_PRIVATE_KEY = process.env.SARANG_LICENSE_ED25519_PRIVATE_KEY_B64
  ? Buffer.from(process.env.SARANG_LICENSE_ED25519_PRIVATE_KEY_B64, 'base64').toString('utf8')
  : '';
// Fail closed (2026-09-30, founder's explicit decision) — same posture as the HMAC secret above
// and the webhook secrets below: this key signs every SARANG2/SARANG3 license key this server
// issues, so silently limping along without it (the old behavior — just a console.error, server
// kept running) meant every paid/trial key issuance would 500 at request time instead of failing
// obviously at boot. No NODE_ENV/dev-mode distinction exists elsewhere in this file, so this
// doesn't invent one — it fails closed unconditionally.
if (!SARANG_LICENSE_ED25519_PRIVATE_KEY) {
  console.error('❌ FATAL: SARANG_LICENSE_ED25519_PRIVATE_KEY_B64 not set. Refusing to start — SARANG2/SARANG3 key issuance would fail on every request without it.');
  process.exit(1);
}
// 2026-09-02 hardening — remote kill switch (59.6). A single GLOBAL flag,
// not per-customer: the founder flips this in the Render dashboard (env var
// + restart, no code deploy) if the app's own day-335/365 expiry math ever
// ships a bug, to relax enforcement across every install until a fixed app
// version rolls out. Read fresh on every /api/sarang-heartbeat request, not
// cached, so a flip takes effect on the very next ping any install makes —
// no restart-the-server-twice gotcha.
const SARANG_ENFORCEMENT_SUSPENDED = () => process.env.SARANG_ENFORCEMENT_SUSPENDED === 'true';

// ── Nodemailer transporter factory ────────────────────────────
// Fresh transporter per send — avoids stale TCP connections after
// server idle periods which cause sendMail to silently fail.
function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.zoho.in',
    port: 465,
    secure: true,
    auth: {
      user: ZOHO_EMAIL,
      pass: ZOHO_PASSWORD
    }
  });
}

// Verify SMTP credentials at startup (fresh connection, not reused)
createTransporter().verify((error) => {
  if (error) {
    console.error('❌ SMTP connection failed:', error.message, '| code:', error.code);
  } else {
    console.log('✅ SMTP connection verified — ready to send mail');
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

// Render puts exactly one reverse proxy hop in front of this service, which
// sets X-Forwarded-For to the real client IP. Without this, every per-IP
// rate limiter below is trivially bypassable: `req.headers['x-forwarded-for']`
// is attacker-controlled input (nothing stops a caller from sending their
// own X-Forwarded-For header directly), and naively reading it — as this
// file used to, via `.split(',')[0]` — trusts whatever the client claims.
// `trust proxy = 1` makes Express's own `req.ip` instead read the address
// added by the one hop we actually trust (Render's edge), which a client
// cannot forge by sending its own header. If Render's proxy chain is ever
// more than one hop deep, this number needs to change accordingly — worth
// confirming against Render's own docs/dashboard for this service.
app.set('trust proxy', 1);

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
// `verify` captures the raw, unparsed body onto req.rawBody — required for
// webhook signature verification (Razorpay/Lemon Squeezy both sign over the
// raw bytes, not the re-serialized JSON, which can differ in whitespace/key
// order and silently break signature checks if you sign the parsed object).
app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── File upload ────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ── HTML-escaping for user-supplied text embedded in emails ─
// Every email built below interpolates raw form input (name/email/message/
// etc.) straight into an HTML string. Unescaped, a submitter can inject
// arbitrary markup into an email a real person (the founder, or a customer)
// opens — broken layout, hidden links/phishing content, spoofed-looking
// blocks — and /api/contact and /api/apply never validated the email field's
// shape at all, so that field was wide open. Escape on the way into HTML,
// never on the way in, so the underlying data (e.g. what's sent to a Sheet)
// stays exactly what the submitter typed.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Contact form ───────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, company, enquiryType, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeCompany = escapeHtml(company);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

    const type    = enquiryType || 'General Enquiry';
    const subject = type === 'Delivery Partnership'
      ? `Partnership Enquiry: ${name} | ${company || 'No company'}`
      : `New Contact [${type}]: ${name}`;

    const html = type === 'Delivery Partnership' ? `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#0EA5E9;border-bottom:2px solid #0EA5E9;padding-bottom:8px;">
          New Delivery Partnership Enquiry
        </h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:8px 0;color:#666;width:120px;"><b>Name</b></td><td>${safeName}</td></tr>
          <tr><td style="padding:8px 0;color:#666;"><b>Company</b></td><td>${safeCompany || 'Not provided'}</td></tr>
          <tr><td style="padding:8px 0;color:#666;"><b>Email</b></td><td><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
        </table>
        <p style="color:#666;margin-bottom:8px;"><b>Message:</b></p>
        <div style="background:#f7f9fc;border-left:4px solid #0EA5E9;padding:16px;border-radius:4px;line-height:1.7;">
          ${safeMessage}
        </div>
      </div>
    ` : `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h3 style="color:#0D1321;">New Contact Form Submission</h3>
        <p><b>Name:</b> ${safeName}</p>
        <p><b>Email:</b> ${safeEmail}</p>
        <p><b>Company:</b> ${safeCompany || 'N/A'}</p>
        <p><b>Enquiry Type:</b> ${escapeHtml(type)}</p>
        <p><b>Message:</b><br>${safeMessage}</p>
      </div>
    `;

    await createTransporter().sendMail({
      from:    `"AszureX" <${ZOHO_EMAIL}>`,
      to:      TO_EMAIL,
      replyTo: email,
      subject,
      html
    });

    console.log(`✅ Contact email sent [${type}] — from: ${email}`);
    return res.json({ success: true, message: 'Message sent! We\'ll be in touch within one business day.' });

  } catch (error) {
    console.error('❌ Contact email error:', error.message, '| code:', error.code, '| response:', error.response);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message. Please email us directly at contact@aszurex.com'
    });
  }
});

// ── Career form ────────────────────────────────────────────
app.post('/api/apply', upload.single('resume'), async (req, res) => {
  try {
    const { name, email, phone, position, experience, coverLetter } = req.body;
    const resume = req.file;

    await createTransporter().sendMail({
      from:    `"AszureX" <${ZOHO_EMAIL}>`,
      to:      TO_EMAIL,
      replyTo: email,
      subject: `Job Application: ${position}`,
      html: `
        <h2>New Job Application</h2>
        <p><strong>Position:</strong> ${escapeHtml(position)}</p>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Experience:</strong> ${escapeHtml(experience)}</p>
        <p><strong>Cover Letter:</strong></p>
        <p>${escapeHtml(coverLetter) || 'N/A'}</p>
      `,
      attachments: resume ? [{
        content:     fs.readFileSync(resume.path).toString('base64'),
        filename:    resume.originalname,
        contentType: resume.mimetype
      }] : []
    });

    console.log(`✅ Job application email sent — ${name} for ${position}`);

    if (resume && fs.existsSync(resume.path)) fs.unlinkSync(resume.path);

    return res.json({ success: true, message: 'Application submitted successfully!' });

  } catch (error) {
    console.error('❌ Job application email error:', error.message, '| code:', error.code);
    return res.status(500).json({ success: false, message: 'Failed to submit application.' });
  }
});

// ── Sarang: add-seats request (U5, 2026-09-29; dynamic checkout added 2026-09-30) ──
// Three-step fallback, in order: (1) a ready-made static Payment Link for this exact seat
// count/region (SARANG_SEAT_PAYMENT_LINKS_JSON) — send the customer straight there. (2) no static
// link — try creating a real, one-time Payment Link/Checkout via the provider's API for the exact
// computed amount (createRazorpaySeatPaymentLink/createLemonSqueezySeatCheckout below) — this is
// what makes any seat count 2-20 fully self-serve with zero AszureX involvement. (3) that also
// isn't available/fails — email AszureX so the founder can create the right-amount Payment
// Link/checkout by hand, exactly as this route has always done. Step (2) is a no-op (returns null
// immediately, no network call) until the founder adds its env vars to Render — see the comment
// above createRazorpaySeatPaymentLink — so until then this route's behavior is byte-for-byte
// identical to before step (2) existed.

// Pricing — MUST stay numerically identical to public/sarang-add-seats.html's <script> block
// (PER_SEAT_IN/PER_SEAT_INTL), which is what actually renders the price the customer sees before
// clicking through to checkout. Per-seat price confirmed 2026-09-30: ₹2,999 / $59.
//
// Real bug fixed 2026-10-01: this page is EXCLUSIVELY for customers who already own a base
// license and just want more PCs (see the page copy on sarang-add-seats.html — "Your base
// license covers your shop PC (1 seat)... buy extra seats here"). This function used to add
// SARANG_SEAT_BASE_IN/SARANG_SEAT_BASE_INTL on top of the per-seat cost, re-charging the full
// base license price every time, on top of the extra seats, even though the customer already
// paid for the base. Standard seat-billing practice (Zoho Books et al.) never re-charges the
// base fee for incremental seats — only the seats themselves. The BASE_* constants are removed
// entirely from this formula; it now returns ONLY the incremental seat cost.
const SARANG_SEAT_PER_SEAT_IN = 2999;
const SARANG_SEAT_PER_SEAT_INTL = 59;
function computeSarangSeatTotal(seatCount, region) {
  const extra = seatCount - 1;
  return region === 'IN'
    ? extra * SARANG_SEAT_PER_SEAT_IN
    : extra * SARANG_SEAT_PER_SEAT_INTL;
}

// ── Seat co-terming (2026-10-01) ──────────────────────────────
// Extra seats bought via sarang-add-seats.html must run for the REMAINDER of the customer's
// existing license period, not reset to a fresh 365-day cycle (that silently discards whatever
// time was left — see issueRenewalKey() below for the actual co-terming math). server.js is
// stateless (no DB), so it can't look up the customer's real current expiry itself; instead the
// customer self-reports it (visible to them in-app under Settings → License) on the add-seats
// form, as an ISO "YYYY-MM-DD" string from an <input type="date">. This validates that
// self-reported value: returns a Date at UTC midnight of that day if it's a real, parseable date
// strictly in the future, or null otherwise (missing field, garbage string, or a past/today
// date — co-terming to a non-future date would issue an already-expired key). Callers MUST treat
// null as "co-terming unavailable" and fall through to the existing default behavior, never as a
// reason to fail the request — a malformed date must never block a purchase.
function parseValidFutureDate(value) {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // Upper bound: a real license never has more than one paid cycle (365 days) left, so a
  // later self-reported date is either a typo or an attempt to back-date the new key into a
  // multi-year license. 366 days leaves a day of slack for timezone differences.
  const maxMs = Date.now() + 366 * 86_400_000;
  return d.getTime() > Date.now() && d.getTime() <= maxMs ? d : null;
}

// ── Dynamic self-serve seat checkout (2026-09-30) — NOT YET CONFIGURED IN PRODUCTION ──
// None of the five env vars below exist on Render yet. Until the founder adds them, both
// createRazorpaySeatPaymentLink() and createLemonSqueezySeatCheckout() return null immediately —
// no network call is made — so /api/sarang-seat-checkout keeps behaving exactly as it does today.
//   RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET — Razorpay Dashboard → Settings → API Keys → Generate
//     Key. NOT the same value as RAZORPAY_WEBHOOK_SECRET above — that one verifies inbound
//     webhooks, these authenticate outbound calls that CREATE Payment Links.
//   LEMONSQUEEZY_API_KEY — Lemon Squeezy Dashboard → Settings → API → Create API key.
//   LEMONSQUEEZY_STORE_ID — Lemon Squeezy Dashboard → Settings → Stores (the numeric store id
//     shown there).
//   LEMONSQUEEZY_VARIANT_ID — the id of a single "Sarang extra seats" product variant, created
//     once by hand in the Lemon Squeezy dashboard with its pricing model set to "Pay what you
//     want" (minimum price can be $0 or $149 — it's just a floor). This is load-bearing: Lemon
//     Squeezy's Checkouts API only honors the custom_price override below when the target variant
//     is actually configured for PWYW pricing. On an ordinary fixed-price variant, custom_price is
//     silently ignored by Lemon Squeezy and the customer is charged that variant's own fixed
//     price instead of the seat-count-based total shown on the page — Lemon Squeezy gives no error
//     for this, so it must be verified once in Lemon Squeezy TEST mode (a $0 test transaction)
//     before this is trusted for a real sale. This is a genuine architectural difference from the
//     Razorpay side: Razorpay Payment Links take an arbitrary amount directly; Lemon Squeezy
//     checkouts are always created against a pre-configured variant, and only a PWYW-priced
//     variant lets that variant's effective price be overridden per request.
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const LEMONSQUEEZY_API_KEY = process.env.LEMONSQUEEZY_API_KEY || '';
const LEMONSQUEEZY_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID || '';
const LEMONSQUEEZY_VARIANT_ID = process.env.LEMONSQUEEZY_VARIANT_ID || '';

// Creates a real, one-time-use Razorpay Payment Link for the exact computed amount and returns
// its URL — or null if RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET aren't configured yet, or if the API
// call fails for any reason (network, bad credentials, rate limit, ...). Callers must treat null
// exactly like "no static link either" and fall through to the existing email-the-founder path —
// a failed automated attempt must never be worse than today's manual fallback, and must never
// 500 the customer's request.
//
// No partner ref: sarang-add-seats.html has no ?ref= capture today (unlike sarang.html's
// captureSarangReferral()), so there is no known partner code to attach at checkout time for this
// route. notes.ref is intentionally left unset here — partner attribution for extra-seat sales
// stays a manual, founder-created Payment Link for now, matching current scope.
async function createRazorpaySeatPaymentLink(seatCount, email, currentExpiryDate = null) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return null;
  try {
    const amountRupees = computeSarangSeatTotal(seatCount, 'IN');
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const notes = { seats: String(seatCount) }; // read back by /api/webhooks/razorpay's issueRenewalKey() call
    if (currentExpiryDate) notes.currentExpiryDate = currentExpiryDate.toISOString().slice(0, 10); // co-terming — see issueRenewalKey()
    const resp = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: JSON.stringify({
        amount: amountRupees * 100, // Razorpay wants paise, not rupees
        currency: 'INR',
        description: `Sarang Business OS Lite — ${seatCount} PCs (annual license)`,
        customer: { email },
        notify: { email: true, sms: false },
        reminder_enable: true,
        notes // read back by /api/webhooks/razorpay's issueRenewalKey() call
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) {
      console.error('❌ Razorpay Payment Link creation failed:', resp.status, (await resp.text().catch(() => '')).slice(0, 300));
      return null;
    }
    const data = await resp.json();
    return data?.short_url || null;
  } catch (error) {
    console.error('❌ Razorpay Payment Link creation error (falling back to email):', error.message);
    return null;
  }
}

// Creates a real, one-time-use Lemon Squeezy Checkout for the exact computed amount, via the
// custom_price override on the single PWYW-configured LEMONSQUEEZY_VARIANT_ID (see the env-var
// comment above — this only actually charges the right amount if that variant is genuinely
// configured for "Pay what you want" pricing on the Lemon Squeezy side). Returns the checkout
// URL, or null on any missing config/failure so the caller falls through to the email fallback,
// same contract as the Razorpay function above.
async function createLemonSqueezySeatCheckout(seatCount, email, currentExpiryDate = null) {
  if (!LEMONSQUEEZY_API_KEY || !LEMONSQUEEZY_STORE_ID || !LEMONSQUEEZY_VARIANT_ID) return null;
  try {
    const amountDollars = computeSarangSeatTotal(seatCount, 'INTL');
    const custom = { seats: String(seatCount) }; // read back by /api/webhooks/lemonsqueezy's issueRenewalKey() call
    if (currentExpiryDate) custom.currentExpiryDate = currentExpiryDate.toISOString().slice(0, 10); // co-terming — see issueRenewalKey()
    const resp = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${LEMONSQUEEZY_API_KEY}`
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            custom_price: amountDollars * 100, // cents; only honored on a PWYW-priced variant, see comment above
            product_options: {
              name: `Sarang Business OS Lite — ${seatCount} PCs (annual license)`,
              description: `Annual license covering ${seatCount} PCs signed in at once.`
            },
            checkout_data: {
              email,
              custom // read back by /api/webhooks/lemonsqueezy's issueRenewalKey() call
            }
          },
          relationships: {
            store: { data: { type: 'stores', id: String(LEMONSQUEEZY_STORE_ID) } },
            variant: { data: { type: 'variants', id: String(LEMONSQUEEZY_VARIANT_ID) } }
          }
        }
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) {
      console.error('❌ Lemon Squeezy checkout creation failed:', resp.status, (await resp.text().catch(() => '')).slice(0, 300));
      return null;
    }
    const data = await resp.json();
    return data?.data?.attributes?.url || null;
  } catch (error) {
    console.error('❌ Lemon Squeezy checkout creation error (falling back to email):', error.message);
    return null;
  }
}

const sarangSeatRequestHits = new Map(); // ip -> [timestamps]
function isSeatRequestRateLimited(ip) {
  const now = Date.now();
  const hits = (sarangSeatRequestHits.get(ip) || []).filter(t => now - t < 60 * 60 * 1000);
  hits.push(now);
  sarangSeatRequestHits.set(ip, hits);
  return hits.length > 5; // 5 requests/hour/IP — a genuine buyer never needs more than a couple
}

app.post('/api/sarang-seat-checkout', async (req, res) => {
  try {
    const ip = req.ip || 'unknown'; // trust-proxy-aware (see app.set('trust proxy', 1) above) — not attacker-forgeable
    if (isSeatRequestRateLimited(ip)) {
      return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
    }

    const { email, seats, region, currentExpiryDate } = req.body;
    const seatCount = Number(seats);
    if (!email || !SARANG_EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    if (!Number.isInteger(seatCount) || seatCount < 2 || seatCount > 20) {
      return res.status(400).json({ success: false, message: 'Please choose between 2 and 20 total PCs.' });
    }
    const seatRegion = region === 'INTL' ? 'INTL' : 'IN';

    // Co-terming (2026-10-01): missing/unparseable/past-dated input never blocks the purchase —
    // it just falls back to null, meaning "co-terming unavailable", and issueRenewalKey() falls
    // back to its existing default (a fresh full cycle from today). See parseValidFutureDate().
    const validExpiryDate = parseValidFutureDate(currentExpiryDate);
    if (currentExpiryDate && !validExpiryDate) {
      console.log(`ℹ️  Seat-checkout: currentExpiryDate "${currentExpiryDate}" missing/unparseable/not in the future — proceeding without co-terming (${email}).`);
    }

    // A ready-made Payment Link for this exact tier — send the customer straight there.
    const paymentUrl = SARANG_SEAT_PAYMENT_LINKS?.[String(seatCount)]?.[seatRegion];
    if (paymentUrl) {
      console.log(`✅ Seat-checkout: known Payment Link used — ${email}, ${seatCount} seats, ${seatRegion}`);
      return res.json({ success: true, paymentUrl });
    }

    // No static link — try creating a real one-time Payment Link/Checkout via the provider's API.
    // No-ops (returns null, no network call) until the founder configures the relevant env vars;
    // also falls through to the email path below on any live failure — see the two functions'
    // own comments above for the full contract.
    const dynamicPaymentUrl = seatRegion === 'IN'
      ? await createRazorpaySeatPaymentLink(seatCount, email, validExpiryDate)
      : await createLemonSqueezySeatCheckout(seatCount, email, validExpiryDate);
    if (dynamicPaymentUrl) {
      console.log(`✅ Seat-checkout: dynamic Payment Link created — ${email}, ${seatCount} seats, ${seatRegion}`);
      return res.json({ success: true, paymentUrl: dynamicPaymentUrl });
    }

    // No link for this tier yet (static or dynamic) — notify AszureX to follow up by hand.
    const submittedAt = new Date().toISOString();
    if (SARANG_SEAT_REQUEST_SHEET_WEBHOOK_URL) {
      fetch(SARANG_SEAT_REQUEST_SHEET_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, seats: seatCount, region: seatRegion, submittedAt })
      }).catch(err => console.error('⚠️  Sarang seat-request sheet webhook failed (non-blocking):', err.message));
    }
    await createTransporter().sendMail({
      from: `"AszureX" <${ZOHO_EMAIL}>`,
      to: TO_EMAIL,
      replyTo: email,
      subject: `Add-seats request: ${seatCount} PCs (${seatRegion}) — ${email}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;">
          <h3 style="color:#0D1321;">New add-seats request</h3>
          <p><b>Email:</b> ${escapeHtml(email)}</p>
          <p><b>Total PCs wanted:</b> ${seatCount} (${seatCount - 1} extra)</p>
          <p><b>Region:</b> ${seatRegion === 'IN' ? 'India (Razorpay)' : 'International (Lemon Squeezy)'}</p>
          <p style="color:#666;font-size:13px;">Create a Payment Link/checkout for this seat count with notes.seats=${seatCount} (Razorpay) or custom_data.seats=${seatCount} (Lemon Squeezy) and send it to the customer; the renewal webhook already knows how to read that field.</p>
        </div>
      `
    });

    console.log(`✅ Seat-checkout: no link configured, founder notified — ${email}, ${seatCount} seats, ${seatRegion}`);
    return res.json({ success: true, message: `Thanks — we'll email you a payment link for ${seatCount} PCs shortly.` });

  } catch (error) {
    console.error('❌ Seat-checkout error:', error.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please email contact@aszurex.com instead.' });
  }
});

// ── Sarang: partner program sign-up (U7, 2026-09-29) ────────
// A partner code here is a SUGGESTION only — sarang-partners.html section 2 is explicit that
// every application is reviewed by hand and may be declined; the founder confirms or changes
// this code when accepting the partner, then bakes it into that partner's Payment Link
// (notes.ref for Razorpay, checkout[custom][ref] for Lemon Squeezy) and their referral URL
// (?ref=CODE on sarang.html — see captureSarangReferral() there).
function suggestPartnerCode(businessName) {
  const slug = (businessName || 'PARTNER').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'PARTNER';
  const suffix = Math.floor(100 + Math.random() * 900); // 3 digits, never leading-zero-ambiguous
  return `${slug}${suffix}`;
}

app.post('/api/partner-signup', async (req, res) => {
  try {
    const ip = req.ip || 'unknown'; // trust-proxy-aware (see app.set('trust proxy', 1) above) — not attacker-forgeable
    if (isRateLimited(ip)) {
      return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
    }

    const { name, email, phone, businessName, city, pan, gstin, notes, acceptedTerms } = req.body;
    if (!name || !email || !phone || !businessName || !city) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }
    if (!SARANG_EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    if (acceptedTerms !== 'yes') {
      return res.status(400).json({ success: false, message: 'Please accept the Partner Terms to continue.' });
    }

    const suggestedCode = suggestPartnerCode(businessName);
    const submittedAt = new Date().toISOString();

    if (SARANG_PARTNER_SIGNUP_SHEET_WEBHOOK_URL) {
      fetch(SARANG_PARTNER_SIGNUP_SHEET_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, businessName, city, pan: pan || '', gstin: gstin || '', notes: notes || '', suggestedCode, status: 'pending review', submittedAt })
      }).catch(err => console.error('⚠️  Sarang partner-signup sheet webhook failed (non-blocking):', err.message));
    }

    await createTransporter().sendMail({
      from: `"AszureX" <${ZOHO_EMAIL}>`,
      to: TO_EMAIL,
      replyTo: email,
      subject: `New partner application: ${businessName} (${name})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;">
          <h3 style="color:#0D1321;">New Sarang partner application</h3>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#666;width:140px;"><b>Name</b></td><td>${escapeHtml(name)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;"><b>Email</b></td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
            <tr><td style="padding:6px 0;color:#666;"><b>Phone</b></td><td>${escapeHtml(phone)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;"><b>Business</b></td><td>${escapeHtml(businessName)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;"><b>City</b></td><td>${escapeHtml(city)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;"><b>PAN</b></td><td>${escapeHtml(pan) || 'Not given'}</td></tr>
            <tr><td style="padding:6px 0;color:#666;"><b>GSTIN</b></td><td>${escapeHtml(gstin) || 'Not given'}</td></tr>
            <tr><td style="padding:6px 0;color:#666;"><b>Suggested code</b></td><td><b>${suggestedCode}</b> (edit if you like before using it)</td></tr>
          </table>
          ${notes ? `<p style="color:#666;margin-top:12px;"><b>How they plan to refer:</b><br>${escapeHtml(notes).replace(/\n/g, '<br>')}</p>` : ''}
          <p style="color:#666;font-size:13px;margin-top:16px;">To accept: reply to this email, then send them a partner link like https://aszurex.com/sarang.html?ref=${suggestedCode} and, when you create their Payment Link, set notes.ref=${suggestedCode} (Razorpay) or checkout[custom][ref]=${suggestedCode} in their Lemon Squeezy checkout URL — commission then logs itself automatically.</p>
        </div>
      `
    });

    console.log(`✅ Partner application received and founder notified — ${businessName} (${email}), suggested code ${suggestedCode}`);
    return res.json({ success: true });

  } catch (error) {
    console.error('❌ Partner signup error:', error.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again or email contact@aszurex.com.' });
  }
});

// ── Sarang: license key generation (Phase 59.2) ─────────────
// Mirrors sarang-business-os/src/main/services/license.service.ts's
// generateLicenseKey()/parseAndVerifyLicenseKey() exactly — same format,
// same HMAC-SHA256 algorithm — so a key issued here validates fully
// offline in the app with no further server involvement.
//
// Real bug found+fixed 2026-07-29: the payload used to be built from only
// tier+region+issuedDay, with zero per-request entropy — HMAC-SHA256 is
// deterministic, so any two people issued a key for the same tier+region on
// the same calendar day (this is the real-world case, not hypothetical, as
// soon as more than one person signs up from the same region on the same
// day) got the byte-for-byte IDENTICAL key string from this exact function.
// Fixed by adding a random nonce as its own payload segment, keeping the
// day-granularity date math the app's trial/renewal logic already depends
// on completely unchanged. Every key already issued/emailed before this fix
// used the old 5-part (no-nonce) format and keeps validating forever — see
// the matching two-shape handling in the app's parseAndVerifyLicenseKey().
function signPayload(payload) {
  return createHmac('sha256', SARANG_LICENSE_HMAC_SECRET).update(payload).digest('hex').slice(0, 12);
}
function generateSarangLicenseKey(tier, region, issuedAt) {
  const daysSinceEpoch = Math.floor(issuedAt.getTime() / 86_400_000);
  // 6 random bytes (12 hex chars, 48 bits) — not a secret, just needs to be
  // unique. Sized from actually measuring the birthday-bound collision rate
  // at 3 bytes live during this fix: ~2.9% chance of any collision at just
  // 1,000 same-day/tier/region signups, rising to ~95% by 10,000 — nowhere
  // near negligible for a product meant to grow. Must match the app's
  // license.service.ts nonce size exactly (both sides mirror each other).
  const nonce = randomBytes(6).toString('hex');
  const payload = `${tier}-${region}-${daysSinceEpoch.toString(36)}-${nonce}`;
  return `SARANG-${payload}-${signPayload(payload)}`;
}

// ── Sarang: SARANG2 (Ed25519) key issuance, 2026-09-02 ──
// Mirrors sarang-business-os/src/main/services/license.service.ts's
// generateLicenseKeyV2() exactly.
function generateSarangLicenseKeyV2(tier, region, issuedAt) {
  const daysSinceEpoch = Math.floor(issuedAt.getTime() / 86_400_000);
  const nonce = randomBytes(6).toString('hex');
  const payload = `${tier}-${region}-${daysSinceEpoch.toString(36)}-${nonce}`;
  const sigHex = cryptoSign(null, Buffer.from(payload), SARANG_LICENSE_ED25519_PRIVATE_KEY).toString('hex');
  return `SARANG2-${payload}-${sigHex}`;
}

// ── Sarang: SARANG3 (Ed25519) key issuance with a seat count, 2026-09-26 ──
// Mirrors sarang-business-os/src/main/services/license-seats.util.ts's parseSeatKey() exactly:
// SARANG3-<TIER>-<REGION>-<issuedDateBase36Days>-<seatsBase36>-<nonce>-<signature>.
// Seats = how many PCs may be signed in at once (the shop PC counts as one). 1 to 99.
function generateSarangLicenseKeyV3(tier, region, issuedAt, seats) {
  const n = Math.max(1, Math.min(99, Math.floor(Number(seats) || 1)));
  const daysSinceEpoch = Math.floor(issuedAt.getTime() / 86_400_000);
  const nonce = randomBytes(6).toString('hex');
  const payload = `${tier}-${region}-${daysSinceEpoch.toString(36)}-${n.toString(36)}-${nonce}`;
  const sigHex = cryptoSign(null, Buffer.from(payload), SARANG_LICENSE_ED25519_PRIVATE_KEY).toString('hex');
  return `SARANG3-${payload}-${sigHex}`;
}

// ── Sarang: remote kill-switch token (Phase 59.6, hardened 2026-09-02) ──
// Mirrors sarang-business-os/src/main/services/license.service.ts's
// signKillSwitchToken()/parseAndVerifyKillSwitchToken() exactly — same
// format, same HMAC-SHA256 algorithm as the (legacy) license-key signer
// above, reusing signPayload(). The app used to trust a bare unsigned
// 'true'/'false' string for this flag with zero cryptographic check (a real
// hole, closed here and on the app side together) — now it's a signed
// token in the same shape as a license key, verified the same way.
function signSarangKillSwitchToken(suspended, issuedAt = new Date()) {
  const daysSinceEpoch = Math.floor(issuedAt.getTime() / 86_400_000);
  const payload = `KILLSWITCH-${suspended ? 1 : 0}-${daysSinceEpoch.toString(36)}`;
  return `SARANG-${payload}-${signPayload(payload)}`;
}

// ── Sarang: per-key revocation token (2026-09-02) ──
// Mirrors sarang-business-os/src/main/services/license.service.ts's
// signRevocationToken()/parseAndVerifyRevocationToken() exactly. The key's
// own hash is embedded in the signed payload so a token can never be
// replayed onto a different key. Only ever issued for a keyHash present in
// SARANG_REVOKED_KEY_HASHES (a founder-edited, comma-separated env var —
// same "flip in Render, no code deploy" operational pattern as the kill
// switch above).
function signSarangRevocationToken(keyHash) {
  const payload = `REVOKE-${keyHash.toLowerCase()}`;
  return `SARANG-${payload}-${signPayload(payload)}`;
}
// SARANG_REVOKED_KEY_HASHES — the actual answer to "one key can serve
// unlimited devices forever": spot a key on an unusual number of distinct
// devices (via the device-activation Sheet's "Flagged for Review" tab, which
// only flags genuinely concurrent multi-device use, never a legitimate
// sequential device replacement), paste its Key Hash into this
// comma-separated env var, and every device sharing it finds out on its next
// daily ping and drops to expired (non-destructive, same as any normal
// expiry — never a data lock). Read fresh per request, same "flip in Render,
// no code deploy" pattern as the kill switch above. Always a manual,
// founder-reviewed decision — never automatic.
function getSarangRevokedKeyHashes() {
  return (process.env.SARANG_REVOKED_KEY_HASHES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

// ── Sarang: very small in-memory per-IP rate limiter (Phase 59.1) ──
// Same shape as sarang-business-os's qr-order-server.ts per-IP limiter —
// this isn't a high-value target, just enough to stop casual form-flooding.
// Resets on server restart, which is fine for this purpose.
const sarangDownloadHits = new Map(); // ip -> [timestamps]
const SARANG_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SARANG_RATE_LIMIT_MAX = 5; // 5 submissions/hour/IP
function isRateLimited(ip) {
  const now = Date.now();
  const hits = (sarangDownloadHits.get(ip) || []).filter(t => now - t < SARANG_RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  sarangDownloadHits.set(ip, hits);
  return hits.length > SARANG_RATE_LIMIT_MAX;
}
// Periodic sweep so this Map never grows unbounded on a long-running process.
setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of sarangDownloadHits.entries()) {
    const fresh = hits.filter(t => now - t < SARANG_RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) sarangDownloadHits.delete(ip);
    else sarangDownloadHits.set(ip, fresh);
  }
}, 15 * 60 * 1000).unref();

const SARANG_DOWNLOAD_URL = 'https://github.com/vishwasgv/Sarang/releases/latest/download/Sarang-Setup-latest.exe';
const SARANG_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Sarang: lead capture + key issuance (Phase 59.1/59.2) ───
app.post('/api/sarang-download', async (req, res) => {
  try {
    const ip = req.ip || 'unknown'; // trust-proxy-aware (see app.set('trust proxy', 1) above) — not attacker-forgeable
    if (isRateLimited(ip)) {
      return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
    }

    // Honeypot: a hidden field real users never fill; bots that fill every
    // field on the form will trip this. Silently "succeed" so a bot doesn't
    // learn its submission was rejected — but never send a real key/email.
    if (req.body.website) {
      return res.json({ success: true, downloadUrl: SARANG_DOWNLOAD_URL });
    }

    const { name, email, phone, country, businessName, businessType, state, city, marketingOptIn, refCode } = req.body;
    const optedInToMarketing = marketingOptIn === 'yes' || marketingOptIn === true;
    // Partner-referral tag (U7) — free text from the ?ref= link, logged as-is for the founder
    // to cross-reference against partner codes; never validated against a partner list here
    // (partners are approved and tracked by hand, see sarang-partners.html section 2).
    const cleanRefCode = typeof refCode === 'string' ? refCode.trim().toUpperCase().slice(0, 40) : '';
    if (!name || !email || !phone || !country || !businessName || !businessType) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }
    if (!SARANG_EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // Region determination (Phase 59.12) — same loose match Sarang's own
    // print.service.ts canShowUpiQr() already uses for this free-text field.
    const region = /^in$/i.test(country.trim()) || /india/i.test(country) ? 'IN' : 'INTL';
    const priceLine = region === 'IN' ? '₹6,999/year (less than ₹600/month)' : '$149/year';

    const issuedAt = new Date();
    const licenseKey = generateSarangLicenseKeyV2('TRIAL', region, issuedAt);

    // Durable lead storage — best-effort, never blocks key delivery if the
    // Sheet webhook is slow/misconfigured/not yet set up.
    if (SARANG_LEAD_SHEET_WEBHOOK_URL) {
      fetch(SARANG_LEAD_SHEET_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, country, state: state || '', city: city || '', businessName: businessName || '', businessType: businessType || '', region, licenseKey, issuedAt: issuedAt.toISOString(), marketingOptIn: optedInToMarketing, refCode: cleanRefCode })
      }).catch(err => console.error('⚠️  Sarang lead-sheet webhook failed (non-blocking):', err.message));
    }

    await createTransporter().sendMail({
      from: `"AszureX" <${ZOHO_EMAIL}>`,
      to: email,
      bcc: TO_EMAIL,
      subject: 'Your Sarang download and license key',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;">
          <h2 style="color:#0EA5E9;">Thanks for trying Sarang</h2>
          <p>Your download link and license key are below. Sarang is free to use for your first 100 days — after that, ${priceLine} keeps it running (you'll get a reminder inside the app well before it applies). License payments are non-refundable.</p>
          <p><a href="${SARANG_DOWNLOAD_URL}" style="display:inline-block;background:#0EA5E9;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Download Sarang for Windows</a></p>
          <p><b>Your license key</b> (enter this during setup):</p>
          <p style="font-family:monospace;font-size:16px;background:#f7f9fc;border-left:4px solid #0EA5E9;padding:12px 16px;border-radius:4px;">${licenseKey}</p>
          <p style="color:#666;font-size:13px;">This key is tied to one device at a time. Keep this email — you can find your license status anytime in Sarang under Settings → License.</p>
        </div>
      `
    });

    console.log(`✅ Sarang download email sent — ${email} (${region})`);
    return res.json({ success: true, downloadUrl: SARANG_DOWNLOAD_URL });

  } catch (error) {
    console.error('❌ Sarang download error:', error.message, '| code:', error.code);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again or email us at contact@aszurex.com' });
  }
});

// ── Sarang: aggregate anonymous daily active-usage metrics ──
// Separate rate limiter from the lead-capture one above — this route can
// legitimately fire much more often per real install (every ~15min while
// online, per the app's own throttle), so a higher ceiling is needed to
// avoid rate-limiting real usage rather than abuse.
const sarangUsageHits = new Map(); // ip -> [timestamps]
const SARANG_USAGE_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SARANG_USAGE_RATE_LIMIT_MAX = 30; // 30 requests/hour/IP
function isUsageRateLimited(ip) {
  const now = Date.now();
  const hits = (sarangUsageHits.get(ip) || []).filter(t => now - t < SARANG_USAGE_RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  sarangUsageHits.set(ip, hits);
  return hits.length > SARANG_USAGE_RATE_LIMIT_MAX;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of sarangUsageHits.entries()) {
    const fresh = hits.filter(t => now - t < SARANG_USAGE_RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) sarangUsageHits.delete(ip);
    else sarangUsageHits.set(ip, fresh);
  }
}, 15 * 60 * 1000).unref();

const SARANG_KEYHASH_RE = /^[a-f0-9]{64}$/;
const SARANG_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SARANG_USAGE_MAX_ENTRIES_PER_REQUEST = 200; // defensive cap, well above any real offline backlog

app.post('/api/sarang-usage', async (req, res) => {
  try {
    const ip = req.ip || 'unknown'; // trust-proxy-aware (see app.set('trust proxy', 1) above) — not attacker-forgeable
    if (isUsageRateLimited(ip)) {
      return res.status(429).json({ success: false, message: 'Too many requests.' });
    }

    if (!SARANG_USAGE_SHEET_WEBHOOK_URL) {
      console.error('❌ Sarang usage-metrics received but SARANG_USAGE_SHEET_WEBHOOK_URL is not set — rejecting (fail closed, client will retry later).');
      return res.status(503).json({ success: false, message: 'Usage metrics not configured.' });
    }

    const { keyHash, region, entries } = req.body;
    if (!keyHash || !SARANG_KEYHASH_RE.test(keyHash)) {
      return res.status(400).json({ success: false, message: 'Invalid key hash.' });
    }
    if (region !== 'IN' && region !== 'INTL') {
      return res.status(400).json({ success: false, message: 'Invalid region.' });
    }
    if (!Array.isArray(entries) || entries.length === 0 || entries.length > SARANG_USAGE_MAX_ENTRIES_PER_REQUEST) {
      return res.status(400).json({ success: false, message: 'Invalid entries.' });
    }
    for (const e of entries) {
      const minutes = Number(e?.minutesUsed);
      if (!e?.date || !SARANG_DATE_RE.test(e.date) || !Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
        return res.status(400).json({ success: false, message: 'Invalid entry.' });
      }
    }

    // Awaited, not fire-and-forget — the client only clears its local queue
    // on a genuine 200 from this route, so this route must only return 200
    // once the sheet write has actually succeeded. Unlike the lead-sheet
    // webhook (best-effort, email is the real record), there is no other
    // durable record of this data — the sheet write IS the source of truth.
    const sheetRes = await fetch(SARANG_USAGE_SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyHash, region, entries }),
      signal: AbortSignal.timeout(10000)
    });

    if (!sheetRes.ok) {
      console.error('❌ Sarang usage-sheet webhook returned non-OK:', sheetRes.status);
      return res.status(502).json({ success: false, message: 'Could not record usage right now.' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('❌ Sarang usage-metrics error:', error.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

// ── Sarang: suggestion box (2026-09-15) ──
// Founder's own framing: "we are definitely not 100% perfect product, your
// message would bring one step closer to it" — a low-friction, honest
// feedback channel on the Sarang product page itself, not buried in the
// general company contact form. Unauthenticated and public, so rate-limited
// per IP; message-only submissions are common for this kind of box, so
// email is optional and not required the way it is on the main contact
// form.
const sarangSuggestionHits = new Map(); // ip -> [timestamps]
const SARANG_SUGGESTION_RATE_LIMIT_MAX = 5; // 5 requests/hour/IP — a real user submits this once, not repeatedly
function isSuggestionRateLimited(ip) {
  const now = Date.now();
  const hits = (sarangSuggestionHits.get(ip) || []).filter(t => now - t < SARANG_USAGE_RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  sarangSuggestionHits.set(ip, hits);
  return hits.length > SARANG_SUGGESTION_RATE_LIMIT_MAX;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of sarangSuggestionHits.entries()) {
    const fresh = hits.filter(t => now - t < SARANG_USAGE_RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) sarangSuggestionHits.delete(ip);
    else sarangSuggestionHits.set(ip, fresh);
  }
}, 15 * 60 * 1000).unref();

const SARANG_SUGGESTION_MAX_LENGTH = 4000; // generous but bounded — defends against abuse, not real feedback

app.post('/api/sarang-suggestion', async (req, res) => {
  try {
    const ip = req.ip || 'unknown'; // trust-proxy-aware (see app.set('trust proxy', 1) above) — not attacker-forgeable
    if (isSuggestionRateLimited(ip)) {
      return res.status(429).json({ success: false, message: 'Too many requests.' });
    }

    const message = (req.body?.message || '').trim();
    const email = (req.body?.email || '').trim();
    if (!message) {
      return res.status(400).json({ success: false, message: 'Please enter a message.' });
    }
    if (message.length > SARANG_SUGGESTION_MAX_LENGTH) {
      return res.status(400).json({ success: false, message: 'Message is too long.' });
    }

    const submittedAt = new Date().toISOString();

    // Email is the real record (like the lead-capture flow) — awaited, so a
    // genuine failure is reported to the submitter rather than silently
    // swallowed.
    await createTransporter().sendMail({
      from: `"AszureX" <${ZOHO_EMAIL}>`,
      to: TO_EMAIL,
      replyTo: email || undefined,
      subject: 'New Sarang suggestion',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;">
          <h3 style="color:#0D1321;">New Sarang Suggestion</h3>
          ${email ? `<p><b>From:</b> ${escapeHtml(email)}</p>` : '<p><b>From:</b> (not provided)</p>'}
          <p><b>Message:</b><br>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
        </div>
      `
    });

    // Best-effort sheet log — same "still works without it" reasoning as the
    // lead-sheet webhook, never allowed to block or fail this response.
    if (SARANG_SUGGESTION_SHEET_WEBHOOK_URL) {
      fetch(SARANG_SUGGESTION_SHEET_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, email: email || null, submittedAt })
      }).catch(err => console.error('⚠️  Sarang suggestion-sheet webhook failed (non-blocking):', err.message));
    }

    console.log(`✅ Sarang suggestion received${email ? ` — from: ${email}` : ''}`);
    return res.json({ success: true, message: 'Thank you — your suggestion has been sent.' });
  } catch (error) {
    console.error('❌ Sarang suggestion error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not send your suggestion. Please try again.' });
  }
});

// ── Sarang: license-status heartbeat / remote kill switch (59.6, hardened 2026-09-02) ──
// This is what license.service.ts's pingLicenseStatusIfDue() actually POSTs
// to — the route genuinely did not exist before this fix (every ping
// silently 404'd and was swallowed by the app's own catch{}, so the kill
// switch had never been exercised for real). Same rate-limiter shape as the
// usage-metrics route above (this can legitimately fire ~once/day per real
// install). No per-customer auth needed: the response carries no customer
// data, is a single global founder-controlled flag, and is itself
// signature-verified by the app — an unauthenticated but rate-limited GET
// of "is enforcement currently suspended" reveals nothing sensitive.
const sarangHeartbeatHits = new Map(); // ip -> [timestamps]
function isHeartbeatRateLimited(ip) {
  const now = Date.now();
  const hits = (sarangHeartbeatHits.get(ip) || []).filter(t => now - t < SARANG_USAGE_RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  sarangHeartbeatHits.set(ip, hits);
  return hits.length > SARANG_USAGE_RATE_LIMIT_MAX;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of sarangHeartbeatHits.entries()) {
    const fresh = hits.filter(t => now - t < SARANG_USAGE_RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) sarangHeartbeatHits.delete(ip);
    else sarangHeartbeatHits.set(ip, fresh);
  }
}, 15 * 60 * 1000).unref();

app.post('/api/sarang-heartbeat', (req, res) => {
  const ip = req.ip || 'unknown'; // trust-proxy-aware (see app.set('trust proxy', 1) above) — not attacker-forgeable
  if (isHeartbeatRateLimited(ip)) {
    return res.status(429).json({ success: false, message: 'Too many requests.' });
  }
  // fingerprintHash doesn't change this response, only the Sheet log below.
  // keyHash IS checked against SARANG_REVOKED_KEY_HASHES — a manual,
  // founder-edited list, never automatic — see the env var's own comment.
  const { keyHash, fingerprintHash } = req.body || {};
  const responseBody = { success: true, enforcementToken: signSarangKillSwitchToken(SARANG_ENFORCEMENT_SUSPENDED()) };
  if (keyHash && getSarangRevokedKeyHashes().includes(keyHash.toLowerCase())) {
    responseBody.revocationToken = signSarangRevocationToken(keyHash);
  }
  res.json(responseBody);
  if (SARANG_DEVICE_SHEET_WEBHOOK_URL && keyHash && fingerprintHash) {
    fetch(SARANG_DEVICE_SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyHash, fingerprintHash, seenAt: new Date().toISOString() })
    }).catch(err => console.error('⚠️  Sarang device-activation sheet webhook failed (non-blocking):', err.message));
  }
});

// ── Shared: issue a PAID license key and email it (59.9/59.12) ──
// receipt (optional): { amount, currency, paymentRef, method, receiptUrl } — the ground-truth
// amount actually captured by the payment provider, not a price we compute ourselves.
// AszureX does not have a confirmed GST registration/GSTIN on file (2026-09-29) — until one
// is added below, this is a payment RECEIPT (proof of what was paid, when, and for what), not
// a GST-compliant tax invoice. Swap ASZUREX_GSTIN once the founder confirms registration status.
const ASZUREX_GSTIN = ''; // TODO: set once confirmed GST-registered; leave blank otherwise
const ASZUREX_BUSINESS_ADDRESS = 'AszureX, India'; // TODO: replace with the full registered address once provided

function receiptNumber(paymentRef) {
  // Not a strict sequential GST invoice number (that needs persistent, unbroken counter
  // storage this stateless server does not have) — a stable, unique reference per payment.
  return `AZX-${String(paymentRef || '').slice(-12).toUpperCase() || Date.now().toString(36).toUpperCase()}`;
}

function receiptHtml({ issuedAt, email, description, receipt, provider = null, fallbackRef = null }) {
  const dateStr = issuedAt.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const hasAmount = !!(receipt && receipt.amount);
  // No usable amount reached us (receipt missing entirely, or present but missing `amount` — e.g.
  // a Razorpay payment_link.paid event with no payload.payment.entity, or a Lemon Squeezy payload
  // whose field names drifted from our best-understanding shape). We still render a genuine
  // receipt block below — never blank — with an honest "see your payment confirmation" line
  // instead of fabricating a number we don't actually have (same principle as the LS field-drift
  // comment on the webhook handler: never show wrong OR blank data).
  const refForReceipt = hasAmount ? receipt.paymentRef : ((receipt && receipt.paymentRef) || fallbackRef);
  const providerLabel = provider || 'your payment processor';
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin-top:24px;border:1px solid #e5e7eb;border-radius:8px;padding:20px;">
      <h3 style="color:#0D1321;margin:0 0 12px;">Payment Receipt</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;">
        <tr><td style="padding:4px 0;color:#666;width:140px;">Receipt No.</td><td>${receiptNumber(refForReceipt)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Date</td><td>${dateStr}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Billed to</td><td>${escapeHtml(email)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Description</td><td>${escapeHtml(description)}</td></tr>
        ${hasAmount
          ? `<tr><td style="padding:4px 0;color:#666;">Amount paid</td><td><b>${escapeHtml(receipt.amount)}</b></td></tr>
        <tr><td style="padding:4px 0;color:#666;">Payment method</td><td>${escapeHtml(receipt.method) || 'Online payment'}</td></tr>`
          : `<tr><td style="padding:4px 0;color:#666;">Amount</td><td>See your payment confirmation from ${escapeHtml(providerLabel)} for the exact amount charged.</td></tr>`}
        <tr><td style="padding:4px 0;color:#666;">Payment reference</td><td>${escapeHtml(refForReceipt) || 'N/A'}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Seller</td><td>${ASZUREX_BUSINESS_ADDRESS}${ASZUREX_GSTIN ? ` — GSTIN ${ASZUREX_GSTIN}` : ''}</td></tr>
      </table>
      ${receipt?.receiptUrl ? `<p style="margin:12px 0 0;font-size:13px;"><a href="${escapeHtml(receipt.receiptUrl)}" style="color:#0EA5E9;">View the official receipt from our payment processor</a></p>` : ''}
      ${!ASZUREX_GSTIN ? `<p style="margin:12px 0 0;font-size:12px;color:#999;">This is a payment receipt. AszureX is not currently registered for GST, so no separate tax invoice with GSTIN is issued.</p>` : ''}
    </div>
  `;
}

// Mirrors sarang-business-os/src/main/services/license.service.ts's LICENSE_PAID_EXPIRES_AFTER_DAYS
// exactly — must stay numerically identical or the co-terming math below lands on the wrong date.
const SARANG_LICENSE_PAID_EXPIRES_AFTER_DAYS = 365;
const SARANG_DAY_MS = 86_400_000;

async function issueRenewalKey({ email, region, seats = 1, receipt = null, provider = null, fallbackRef = null, currentExpiryDate = null }) {
  // Co-terming (2026-10-01): when a valid future currentExpiryDate is supplied (self-reported by
  // the customer on the add-seats form — see parseValidFutureDate()), back-date issuedAt so this
  // key's own expiry (issuedAt + SARANG_LICENSE_PAID_EXPIRES_AFTER_DAYS days, computed the normal
  // way by the app) lands exactly on that same date — i.e. the new seats run out exactly when the
  // rest of the license does, instead of silently granting a fresh full 365-day cycle and
  // discarding whatever time was left. Default (no/invalid currentExpiryDate) is UNCHANGED from
  // before this fix: issuedAt = now, a fresh full cycle — this is the fallback path for every
  // caller that doesn't pass the new param (static-link purchases, the email-fallback flow, and
  // any future non-seat caller of this function).
  const validExpiry = currentExpiryDate instanceof Date && !Number.isNaN(currentExpiryDate.getTime()) && currentExpiryDate.getTime() > Date.now()
    ? currentExpiryDate
    : null;
  const isCoTermed = validExpiry !== null;
  const paymentDate = new Date(); // the real transaction date — always "now", regardless of co-terming; used for the receipt only
  const issuedAt = isCoTermed
    ? new Date(validExpiry.getTime() - SARANG_LICENSE_PAID_EXPIRES_AFTER_DAYS * SARANG_DAY_MS)
    : paymentDate;
  // One seat (the shop PC) keeps the plain SARANG2 key; more seats need the SARANG3 key that carries the count.
  const licenseKey = seats > 1 ? generateSarangLicenseKeyV3('PAID', region, issuedAt, seats) : generateSarangLicenseKeyV2('PAID', region, issuedAt);
  const description = isCoTermed
    ? `Sarang Business OS Lite — Extra seats added to existing license${seats > 1 ? ` (now ${seats} PCs total)` : ''}, now expiring ${validExpiry.toISOString().slice(0, 10)}`
    : `Sarang Business OS Lite — Annual License${seats > 1 ? ` (${seats} PCs)` : ''}`;
  await createTransporter().sendMail({
    from: `"AszureX" <${ZOHO_EMAIL}>`,
    to: email,
    bcc: TO_EMAIL,
    subject: isCoTermed ? 'Your extra Sarang seats are ready' : 'Your renewed Sarang license',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#0EA5E9;">${isCoTermed ? 'Your extra Sarang seats are ready' : 'Thank you for renewing Sarang'}</h2>${seats > 1 ? `<p>This key covers ${seats} PCs signed in at the same time.</p>` : ''}${isCoTermed ? `<p>This new key runs on the same schedule as your existing license — it expires ${validExpiry.toISOString().slice(0, 10)}, not a fresh year from today.</p>` : ''}
        <p>Your new license key is below — enter it in Sarang under Settings → License to keep everything working exactly as before.</p>
        <p style="font-family:monospace;font-size:16px;background:#f7f9fc;border-left:4px solid #0EA5E9;padding:12px 16px;border-radius:4px;">${licenseKey}</p>
      </div>
      ${receiptHtml({ issuedAt: paymentDate, email, description, receipt, provider, fallbackRef })}
    `
  });
  console.log(`✅ Renewal key issued and emailed — ${email} (${region}, ${seats} seat${seats === 1 ? '' : 's'}${isCoTermed ? `, co-termed to expire ${validExpiry.toISOString().slice(0, 10)}` : ', fresh cycle from today'}${receipt && receipt.amount ? ', receipt included' : ', minimal fallback receipt (no amount data on this event — customer still got a referenced receipt block)'})`);
  return licenseKey;
}

// ── Razorpay webhook (Phase 59.9 — India renewals) ──────────
// Signature verification is NOT optional — see PHASE_59 doc Section 59.9.
// Without this, anyone who finds this URL could forge a fake "payment
// captured" event and mint themselves a free PAID key.
// Google Apps Script Web App URL for the Sarang partner-commission sheet (U7, 2026-09-29) —
// this sheet IS the commission ledger: the founder reviews each row and pays out by hand
// (see sarang-partners.html section 4 — commission is calculated, never auto-disbursed).
const SARANG_COMMISSION_SHEET_WEBHOOK_URL = process.env.SARANG_COMMISSION_SHEET_WEBHOOK_URL || '';
const PARTNER_COMMISSION_RATE = 0.20; // matches sarang-partners.html section 4 — first paid year only

// Logs a commission line when a paid key is issued with a partner ref attached (set on the
// Payment Link/checkout the founder creates for that partner, per sarang-partners.html section
// 2). Never blocks key issuance — a missing/misconfigured sheet loses only the ledger row, not
// the customer's license.
function recordPartnerCommission({ ref, email, amountValue, currency, region, paymentRef }) {
  if (!ref || !amountValue) return;
  const commission = Math.round(amountValue * PARTNER_COMMISSION_RATE * 100) / 100;
  console.log(`✅ Partner commission: ${ref} earns ${currency}${commission} on ${email} (${region}, ref ${paymentRef})`);
  if (SARANG_COMMISSION_SHEET_WEBHOOK_URL) {
    fetch(SARANG_COMMISSION_SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref, customerEmail: email, saleAmount: amountValue, currency, commissionAmount: commission, region, paymentRef, recordedAt: new Date().toISOString() })
    }).catch(err => console.error('⚠️  Sarang commission-sheet webhook failed (non-blocking):', err.message));
  }
}

// ── Webhook event de-dup (best-effort, in-memory) ──
// Two real failure modes both mint a SECOND paid license key (and double-log
// partner commission) for a single real payment if left unguarded:
//   1. Razorpay fires BOTH `payment.captured` AND `payment_link.paid` for the
//      SAME payment when checkout goes through a Payment Link — which is
//      this system's actual checkout mechanism (see the seat-checkout/
//      partner-signup comments above). This isn't a rare edge case, it's the
//      expected shape of every Payment Link sale.
//   2. Either provider may retry a webhook call that timed out on their end
//      (e.g. a slow email send held the response past their timeout).
// Keyed on a stable id from the event itself (the underlying payment id for
// Razorpay, the event's own resource id for Lemon Squeezy) so genuinely
// distinct payments never collide. Claimed BEFORE issueRenewalKey() runs
// (not after) so two near-simultaneous requests for the same payment can't
// race past the check before either finishes — and released again if
// issuance actually fails, so a real transient failure doesn't get
// permanently swallowed as a "duplicate" on the provider's legitimate retry.
// In-memory only — doesn't survive a restart/redeploy and wouldn't dedup
// across multiple instances if this were ever horizontally scaled. Render
// runs this as a single instance, so it closes both failure modes above; a
// fully durable fix needs a persistent store (a DB row per payment id),
// worth doing if a database gets added here for other reasons.
const sarangProcessedPaymentIds = new Set();
const sarangProcessedPaymentTimestamps = new Map(); // dedupKey -> firstSeenAt, for the sweep
const SARANG_PAYMENT_DEDUP_TTL_MS = 48 * 60 * 60 * 1000; // comfortably longer than any real provider retry window
function claimPaymentDedup(dedupKey) {
  // No stable id to key on — can't dedup, don't block issuance.
  if (!dedupKey) return true;
  if (sarangProcessedPaymentIds.has(dedupKey)) return false;
  sarangProcessedPaymentIds.add(dedupKey);
  sarangProcessedPaymentTimestamps.set(dedupKey, Date.now());
  return true;
}
function releasePaymentDedup(dedupKey) {
  if (!dedupKey) return;
  sarangProcessedPaymentIds.delete(dedupKey);
  sarangProcessedPaymentTimestamps.delete(dedupKey);
}
setInterval(() => {
  const cutoff = Date.now() - SARANG_PAYMENT_DEDUP_TTL_MS;
  for (const [key, seenAt] of sarangProcessedPaymentTimestamps.entries()) {
    if (seenAt < cutoff) {
      sarangProcessedPaymentTimestamps.delete(key);
      sarangProcessedPaymentIds.delete(key);
    }
  }
}, 15 * 60 * 1000).unref();

app.post('/api/webhooks/razorpay', async (req, res) => {
  try {
    if (!RAZORPAY_WEBHOOK_SECRET) {
      console.error('❌ Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not set — rejecting (fail closed).');
      return res.status(503).json({ success: false, message: 'Webhook not configured.' });
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({ success: false, message: 'Missing signature.' });
    }

    const expected = createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(req.rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      console.error('❌ Razorpay webhook signature mismatch — rejecting (possible forgery attempt).');
      return res.status(400).json({ success: false, message: 'Invalid signature.' });
    }

    const event = req.body;
    if (event.event === 'payment.captured' || event.event === 'payment_link.paid') {
      const email = event.payload?.payment?.entity?.email || event.payload?.payment_link?.entity?.customer?.email;
      if (!email) {
        console.error('❌ Razorpay webhook payment.captured with no email on the payload — cannot issue a key.', JSON.stringify(event).slice(0, 500));
        return res.status(200).json({ success: true }); // ack the webhook regardless so Razorpay doesn't retry forever; log for manual follow-up
      }
      // Extra PCs are sold as a payment link/order carrying notes.seats (total PCs, shop PC included).
      // A partner sale is a payment link/order carrying notes.ref (the partner's code) — set by
      // the founder when creating that partner's Payment Link, per sarang-partners.html section 2.
      const notes = event.payload?.payment?.entity?.notes || event.payload?.payment_link?.entity?.notes || {};
      const paymentEntity = event.payload?.payment?.entity;
      const receipt = paymentEntity?.amount ? {
        amount: `₹${(paymentEntity.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        method: paymentEntity.method ? paymentEntity.method.toUpperCase() : 'Razorpay',
        paymentRef: paymentEntity.id
      } : null;
      // Real event id for the receipt's reference number even when paymentEntity (and so
      // receipt/receipt.amount) is absent — e.g. a payment_link.paid event whose payload only
      // populated payment_link.entity, not payment.entity. Same ids the dedup key below is built
      // from, so it's still traceable back to this exact event in the logs.
      const fallbackRef = paymentEntity?.id || event.payload?.payment_link?.entity?.id || null;

      // Dedup key: the underlying payment id, present in the payload for both event types this
      // handler reacts to when they represent the same real payment (see the comment above).
      const dedupKey = paymentEntity?.id
        ? `rzp:payment:${paymentEntity.id}`
        : (event.payload?.payment_link?.entity?.id ? `rzp:link:${event.payload.payment_link.entity.id}` : null);
      if (!claimPaymentDedup(dedupKey)) {
        console.log(`⚠️  Razorpay webhook: duplicate event for ${dedupKey} — a key was already issued for this payment, skipping (ack anyway).`);
        return res.status(200).json({ success: true });
      }

      try {
        // Co-terming: notes.currentExpiryDate is only present when createRazorpaySeatPaymentLink()
        // attached it (a dynamic seat-checkout link that carried a valid self-reported date) — a
        // founder-made static Payment Link never has it, so this is undefined/null there and
        // issueRenewalKey() falls back to its default (fresh cycle), unchanged from before.
        await issueRenewalKey({ email, region: 'IN', seats: Number(notes.seats) || 1, receipt, provider: 'Razorpay', fallbackRef, currentExpiryDate: parseValidFutureDate(notes.currentExpiryDate) });
        if (paymentEntity?.amount) {
          recordPartnerCommission({ ref: notes.ref, email, amountValue: paymentEntity.amount / 100, currency: '₹', region: 'IN', paymentRef: paymentEntity.id });
        }
      } catch (issueError) {
        releasePaymentDedup(dedupKey); // issuance didn't actually complete — let a legitimate retry try again
        throw issueError;
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Razorpay webhook error:', error.message);
    return res.status(500).json({ success: false });
  }
});

// ── Lemon Squeezy webhook (Phase 59.12 — international renewals) ──
app.post('/api/webhooks/lemonsqueezy', async (req, res) => {
  try {
    if (!LEMON_SQUEEZY_WEBHOOK_SECRET) {
      console.error('❌ Lemon Squeezy webhook received but LEMON_SQUEEZY_WEBHOOK_SECRET is not set — rejecting (fail closed).');
      return res.status(503).json({ success: false, message: 'Webhook not configured.' });
    }

    const signature = req.headers['x-signature'];
    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({ success: false, message: 'Missing signature.' });
    }

    const expected = createHmac('sha256', LEMON_SQUEEZY_WEBHOOK_SECRET).update(req.rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      console.error('❌ Lemon Squeezy webhook signature mismatch — rejecting (possible forgery attempt).');
      return res.status(400).json({ success: false, message: 'Invalid signature.' });
    }

    const event = req.body;
    const eventName = event.meta?.event_name;
    if (eventName === 'order_created' || eventName === 'subscription_payment_success') {
      const email = event.data?.attributes?.user_email || event.data?.attributes?.customer_email;
      if (!email) {
        console.error('❌ Lemon Squeezy webhook with no email on the payload — cannot issue a key.', JSON.stringify(event).slice(0, 500));
        return res.status(200).json({ success: true });
      }
      const custom = event.meta?.custom_data || {};
      // Lemon Squeezy is merchant of record and already emails its own official receipt/invoice
      // to the buyer, so this is a best-effort supplementary summary, not a replacement for it —
      // exact field names below are our best understanding of the LS webhook payload and are
      // deliberately optional-chained: if the shape differs, `receipt` stays null and
      // receiptHtml() falls back to its minimal receipt block (honest "see your payment
      // confirmation" line + fallbackRef below) rather than showing a wrong amount — never a
      // blank/omitted block, see receiptHtml()'s `hasAmount` branch.
      const lsAttrs = event.data?.attributes;
      const receipt = lsAttrs?.total_formatted ? {
        amount: lsAttrs.total_formatted,
        method: 'Lemon Squeezy',
        paymentRef: lsAttrs.order_number || event.data?.id,
        receiptUrl: lsAttrs.urls?.receipt || lsAttrs.receipt_url || null
      } : null;
      // Real event id for the receipt's reference number even when total_formatted (and so
      // receipt) is absent — same id the dedup key below is built from, so it's still traceable
      // back to this exact event in the logs.
      const fallbackRef = event.data?.id || null;

      // Dedup key: this event's own resource id, namespaced by event name so an order_created id
      // can never collide with an unrelated subscription_payment_success id in the same namespace.
      const dedupKey = event.data?.id ? `ls:${eventName}:${event.data.id}` : null;
      if (!claimPaymentDedup(dedupKey)) {
        console.log(`⚠️  Lemon Squeezy webhook: duplicate event for ${dedupKey} — a key was already issued for this payment, skipping (ack anyway).`);
        return res.status(200).json({ success: true });
      }

      // Price-loophole guard: the seat variant is pay-what-you-want (min $0) on Lemon Squeezy, so the
      // customer can retype the amount on the hosted checkout page. We never trust the amount the
      // checkout was CREATED with; we verify what was actually PAID (net of tax) before issuing seats.
      const orderVariantId = String(lsAttrs?.first_order_item?.variant_id ?? '');
      const seatCountOnOrder = Number(custom.seats) || 0;
      const isSeatOrder = (LEMONSQUEEZY_VARIANT_ID && orderVariantId === String(LEMONSQUEEZY_VARIANT_ID)) || seatCountOnOrder > 1;
      if (isSeatOrder) {
        const expectedUsd = computeSarangSeatTotal(seatCountOnOrder, 'INTL');
        const totalUsd = Number(lsAttrs?.total_usd ?? (lsAttrs?.currency === 'USD' ? lsAttrs?.total : NaN)) / 100;
        const taxUsd = Number(lsAttrs?.tax_usd ?? (lsAttrs?.currency === 'USD' ? lsAttrs?.tax : 0)) / 100 || 0;
        const paidNetUsd = totalUsd - taxUsd;
        const underpaid = expectedUsd <= 0 || !Number.isFinite(paidNetUsd) || paidNetUsd < expectedUsd - 0.5;
        if (underpaid) {
          console.error(`❌ Lemon Squeezy seat order ${fallbackRef} rejected: paid net $${paidNetUsd} < expected $${expectedUsd} for ${seatCountOnOrder} PCs — NO key issued.`);
          try {
            await createTransporter().sendMail({
              from: `"AszureX" <${ZOHO_EMAIL}>`,
              to: TO_EMAIL,
              replyTo: email,
              subject: `ACTION NEEDED: seat order underpaid — ${email}`,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;"><h3>Seat order paid less than the price — no key was issued</h3><p><b>Customer:</b> ${escapeHtml(email)}</p><p><b>PCs requested (total):</b> ${seatCountOnOrder}</p><p><b>Expected (net of tax):</b> $${expectedUsd}</p><p><b>Actually paid (net of tax):</b> ${Number.isFinite(paidNetUsd) ? '$' + paidNetUsd : 'unreadable'}</p><p><b>Lemon Squeezy order:</b> ${escapeHtml(String(lsAttrs?.order_number || fallbackRef || ''))}</p><p>Refund the order in Lemon Squeezy or ask the customer to pay the difference, then issue the key manually.</p></div>`
            });
          } catch (mailErr) {
            console.error('⚠️  Could not email founder about underpaid seat order:', mailErr.message);
          }
          return res.status(200).json({ success: true });
        }
      }

      try {
        // Co-terming: custom.currentExpiryDate is only present when createLemonSqueezySeatCheckout()
        // attached it (a dynamic seat-checkout carrying a valid self-reported date) — any other
        // checkout never has it, so this is undefined/null there and issueRenewalKey() falls back
        // to its default (fresh cycle), unchanged from before.
        await issueRenewalKey({ email, region: 'INTL', seats: Number(custom.seats) || 1, receipt, provider: 'Lemon Squeezy', fallbackRef, currentExpiryDate: parseValidFutureDate(custom.currentExpiryDate) });
        // custom.ref (checkout[custom][ref] on the partner's checkout URL) mirrors Razorpay's notes.ref.
        const totalAmount = Number(lsAttrs?.total) / 100; // LS gives cents; total_formatted is display-only text
        if (Number.isFinite(totalAmount) && totalAmount > 0) {
          recordPartnerCommission({ ref: custom.ref, email, amountValue: totalAmount, currency: lsAttrs?.currency ? `${lsAttrs.currency} ` : '$', region: 'INTL', paymentRef: lsAttrs?.order_number || event.data?.id });
        }
      } catch (issueError) {
        releasePaymentDedup(dedupKey);
        throw issueError;
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Lemon Squeezy webhook error:', error.message);
    return res.status(500).json({ success: false });
  }
});

// ── Clean URL for delivery partnerships page ───────────────
app.get('/delivery-partnerships', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'delivery-partnerships.html'));
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 AszureX server running on port', PORT);
  console.log('   ZOHO_EMAIL set:', !!ZOHO_EMAIL);
  console.log('   TO_EMAIL set:  ', !!TO_EMAIL);
  console.log('='.repeat(50));
});
