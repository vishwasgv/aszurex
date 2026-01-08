const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Email setup - UPDATE THESE LINES!


// Check email config
transporter.verify(function(error, success) {
  if (error) {
    console.log('❌ Email not configured');
  } else {
    console.log('✅ Email ready');
  }
});

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Contact form
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, company, message } = req.body;

    await sgMail.send({
  to: process.env.EMAIL_USER,
  from: process.env.EMAIL_USER, // must be verified in SendGrid
  replyTo: email,
  subject: `New Contact: ${name}`,
  html: `
    <h2>New Contact Form</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Company:</strong> ${company || 'N/A'}</p>
    <p><strong>Message:</strong></p>
    <p>${message}</p>
  `
});
    
    res.json({ success: true, message: 'Message sent!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to send' });
  }
});

// Career form
app.post('/api/apply', upload.single('resume'), async (req, res) => {
  try {
    const { name, email, phone, position, experience, coverLetter } = req.body;
    const resume = req.file;

    await sgMail.send({
  to: process.env.EMAIL_USER,
  from: process.env.EMAIL_USER,
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
    content: fs.readFileSync(resume.path).toString('base64'),
    filename: resume.originalname,
    type: resume.mimetype,
    disposition: 'attachment'
  }] : []
});


    
    console.log('📧 Job application email sent:', info.messageId);

    // Delete resume after sending
    if (resume && fs.existsSync(resume.path)) {
      fs.unlinkSync(resume.path);
    }

    res.json({ success: true, message: 'Application submitted successfully!' });
  } catch (error) {
    console.error('❌ Job application failed:', error);
    res.status(500).json({ success: false, message: 'Failed to submit application' });
  }
});


// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 AszureX Website is LIVE!');
  console.log('='.repeat(50));
  console.log(`📍 Open: http://localhost:${PORT}`);
  console.log('='.repeat(50));
  console.log('📄 Pages:');
  console.log(`   Home:     http://localhost:${PORT}/`);
  console.log(`   Services: http://localhost:${PORT}/services.html`);
  console.log(`   About:    http://localhost:${PORT}/about.html`);
  console.log(`   Careers:  http://localhost:${PORT}/careers.html`);
  console.log(`   Contact:  http://localhost:${PORT}/contact.html`);
  console.log('='.repeat(50) + '\n');
});