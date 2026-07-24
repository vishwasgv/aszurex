const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { createHmac, timingSafeEqual } = require('crypto');

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
const SARANG_LICENSE_HMAC_SECRET = process.env.SARANG_LICENSE_HMAC_SECRET || 'DEV-ONLY-INSECURE-PLACEHOLDER-DO-NOT-SHIP';
// Optional — a Google Apps Script Web App URL (see PHASE_59 doc, 59.1) that
// appends a row to a Google Sheet. Lead capture still works (emails still
// send) without this set; it just means submissions aren't also logged to
// a durable, queryable list yet.
const SARANG_LEAD_SHEET_WEBHOOK_URL = process.env.SARANG_LEAD_SHEET_WEBHOOK_URL || '';
if (!process.env.SARANG_LICENSE_HMAC_SECRET) {
  console.error('❌ SARANG_LICENSE_HMAC_SECRET not set — using an insecure dev placeholder. Set this before going live.');
}
// Set once the founder's Razorpay/Lemon Squeezy accounts are approved —
// found in each provider's dashboard under Webhooks. Until set, the
// corresponding webhook route below rejects everything (fails closed, not
// open — see the checks inside each handler).
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const LEMON_SQUEEZY_WEBHOOK_SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || '';

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

// ── Contact form ───────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, company, enquiryType, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }

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
          <tr><td style="padding:8px 0;color:#666;width:120px;"><b>Name</b></td><td>${name}</td></tr>
          <tr><td style="padding:8px 0;color:#666;"><b>Company</b></td><td>${company || 'Not provided'}</td></tr>
          <tr><td style="padding:8px 0;color:#666;"><b>Email</b></td><td><a href="mailto:${email}">${email}</a></td></tr>
        </table>
        <p style="color:#666;margin-bottom:8px;"><b>Message:</b></p>
        <div style="background:#f7f9fc;border-left:4px solid #0EA5E9;padding:16px;border-radius:4px;line-height:1.7;">
          ${message.replace(/\n/g, '<br>')}
        </div>
      </div>
    ` : `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h3 style="color:#0D1321;">New Contact Form Submission</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Company:</b> ${company || 'N/A'}</p>
        <p><b>Enquiry Type:</b> ${type}</p>
        <p><b>Message:</b><br>${message.replace(/\n/g, '<br>')}</p>
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
        <p><strong>Position:</strong> ${position}</p>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Experience:</strong> ${experience}</p>
        <p><strong>Cover Letter:</strong></p>
        <p>${coverLetter || 'N/A'}</p>
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

// ── Sarang: license key generation (Phase 59.2) ─────────────
// Mirrors sarang-business-os/src/main/services/license.service.ts's
// generateLicenseKey()/parseAndVerifyLicenseKey() exactly — same format,
// same HMAC-SHA256 algorithm — so a key issued here validates fully
// offline in the app with no further server involvement.
function signPayload(payload) {
  return createHmac('sha256', SARANG_LICENSE_HMAC_SECRET).update(payload).digest('hex').slice(0, 12);
}
function generateSarangLicenseKey(tier, region, issuedAt) {
  const daysSinceEpoch = Math.floor(issuedAt.getTime() / 86_400_000);
  const payload = `${tier}-${region}-${daysSinceEpoch.toString(36)}`;
  return `SARANG-${payload}-${signPayload(payload)}`;
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
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
      return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
    }

    // Honeypot: a hidden field real users never fill; bots that fill every
    // field on the form will trip this. Silently "succeed" so a bot doesn't
    // learn its submission was rejected — but never send a real key/email.
    if (req.body.website) {
      return res.json({ success: true, downloadUrl: SARANG_DOWNLOAD_URL });
    }

    const { name, email, phone, country, businessType } = req.body;
    if (!name || !email || !phone || !country) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }
    if (!SARANG_EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // Region determination (Phase 59.12) — same loose match Sarang's own
    // print.service.ts canShowUpiQr() already uses for this free-text field.
    const region = /^in$/i.test(country.trim()) || /india/i.test(country) ? 'IN' : 'INTL';
    const priceLine = region === 'IN' ? '₹599/year (less than ₹50/month)' : '$29/year';

    const issuedAt = new Date();
    const licenseKey = generateSarangLicenseKey('TRIAL', region, issuedAt);

    // Durable lead storage — best-effort, never blocks key delivery if the
    // Sheet webhook is slow/misconfigured/not yet set up.
    if (SARANG_LEAD_SHEET_WEBHOOK_URL) {
      fetch(SARANG_LEAD_SHEET_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, country, businessType: businessType || '', region, licenseKey, issuedAt: issuedAt.toISOString() })
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
          <p>Your download link and license key are below. Sarang is free to use for your first 12 months — after that, ${priceLine} keeps it running (you'll get a reminder inside the app well before it applies).</p>
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

// ── Shared: issue a PAID license key and email it (59.9/59.12) ──
async function issueRenewalKey({ email, region }) {
  const issuedAt = new Date();
  const licenseKey = generateSarangLicenseKey('PAID', region, issuedAt);
  await createTransporter().sendMail({
    from: `"AszureX" <${ZOHO_EMAIL}>`,
    to: email,
    bcc: TO_EMAIL,
    subject: 'Your renewed Sarang license',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#0EA5E9;">Thank you for renewing Sarang</h2>
        <p>Your new license key is below — enter it in Sarang under Settings → License to keep everything working exactly as before.</p>
        <p style="font-family:monospace;font-size:16px;background:#f7f9fc;border-left:4px solid #0EA5E9;padding:12px 16px;border-radius:4px;">${licenseKey}</p>
      </div>
    `
  });
  console.log(`✅ Renewal key issued and emailed — ${email} (${region})`);
  return licenseKey;
}

// ── Razorpay webhook (Phase 59.9 — India renewals) ──────────
// Signature verification is NOT optional — see PHASE_59 doc Section 59.9.
// Without this, anyone who finds this URL could forge a fake "payment
// captured" event and mint themselves a free PAID key.
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
      await issueRenewalKey({ email, region: 'IN' });
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
      await issueRenewalKey({ email, region: 'INTL' });
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
