const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

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
    },
    connectionTimeout: 10000,
    greetingTimeout:   10000,
    socketTimeout:     10000
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
app.use(bodyParser.json());
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
    const { name, email, company, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }

    const isPartnership = message.startsWith('[Delivery Partnership Enquiry]');
    const cleanMessage  = message
      .replace('[Delivery Partnership Enquiry]', '')
      .trim()
      .replace(/\n/g, '<br>');

    const subject = isPartnership
      ? `Partnership Enquiry: ${name} | ${company || 'No company'}`
      : `New Contact: ${name}`;

    const html = isPartnership ? `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#0EA5E9;border-bottom:2px solid #0EA5E9;padding-bottom:8px;">
          New Delivery Partnership Enquiry
        </h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:8px 0;color:#666;width:120px;"><b>Name</b></td><td>${name}</td></tr>
          <tr><td style="padding:8px 0;color:#666;"><b>Company</b></td><td>${company || 'Not provided'}</td></tr>
          <tr><td style="padding:8px 0;color:#666;"><b>Email</b></td><td><a href="mailto:${email}">${email}</a></td></tr>
        </table>
        <p style="color:#666;margin-bottom:8px;"><b>Delivery Challenge:</b></p>
        <div style="background:#f7f9fc;border-left:4px solid #0EA5E9;padding:16px;border-radius:4px;line-height:1.7;">
          ${cleanMessage}
        </div>
        <p style="color:#999;font-size:12px;margin-top:24px;">Submitted via delivery-partnerships page</p>
      </div>
    ` : `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h3 style="color:#0D1321;">New Contact Form Submission</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Company:</b> ${company || 'N/A'}</p>
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

    console.log(`✅ ${isPartnership ? 'Partnership enquiry' : 'Contact email'} sent — from: ${email}`);
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
