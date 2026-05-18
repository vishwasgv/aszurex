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

// ── Nodemailer transporter ─────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.in',
  port: 465,
  secure: true,
  auth: {
    user: ZOHO_EMAIL,
    pass: ZOHO_PASSWORD
  }
});

// Verify SMTP connection at startup
transporter.verify((error) => {
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

    await transporter.sendMail({
      from:    `"AszureX" <${ZOHO_EMAIL}>`,
      to:      TO_EMAIL,
      replyTo: email,
      subject: `New Contact: ${name}`,
      html: `
        <h3>New Contact Form Submission</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Company:</b> ${company || 'N/A'}</p>
        <p><b>Message:</b> ${message}</p>
      `
    });

    console.log(`✅ Contact email sent — from: ${email}`);
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

    await transporter.sendMail({
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

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 AszureX server running on port', PORT);
  console.log('   ZOHO_EMAIL set:', !!ZOHO_EMAIL);
  console.log('   TO_EMAIL set:  ', !!TO_EMAIL);
  console.log('='.repeat(50));
});
