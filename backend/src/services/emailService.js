const sgMail = require('@sendgrid/mail');
const { TRADE_CATEGORIES } = require('../controllers/tradeController');

function categoryLabel(category) {
  return TRADE_CATEGORIES.find((c) => c.id === category)?.label || category;
}

// Never hit the real SendGrid API from automated tests — mirrors the
// geocoding service's test-mode stub. Without this, every test that
// registers/resets/matches a user makes a real network call, which is slow
// and eventually burns through SendGrid's send quota (as happened here).
// Checked per-call (not cached at module load) so it stays correct even if
// NODE_ENV is toggled mid-suite, e.g. by the rate-limiting tests.
function skipSend() {
  return process.env.NODE_ENV === 'test';
}

async function sendPasswordResetEmail(to, token) {
  if (skipSend()) return;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  await sgMail.send({
    to,
    from: process.env.FROM_EMAIL,
    subject: 'Reset your ETradie password',
    text: `You requested a password reset. Click the link below to set a new password (expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    html: `<p>You requested a password reset. Click below to set a new password (expires in 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore this email.</p>`,
  });
}

async function sendVerificationEmail(to, code) {
  if (skipSend()) return;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  await sgMail.send({
    to,
    from: process.env.FROM_EMAIL,
    subject: 'Verify your ETradie email address',
    text: `Your ETradie verification code is: ${code}\n\nEnter this code to finish creating your account. It expires in 15 minutes.\n\nIf you didn't create an account, ignore this email.`,
    html: `<p>Your ETradie verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p><p>Enter this code to finish creating your account. It expires in 15 minutes.</p><p>If you didn't create an account, ignore this email.</p>`,
  });
}

async function sendNewJobMatchEmail(to, job) {
  if (skipSend()) return;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const jobUrl = `${process.env.CLIENT_URL}/jobs/${job.id}`;
  const label = categoryLabel(job.category);
  await sgMail.send({
    to,
    from: process.env.FROM_EMAIL,
    subject: `New job near you: ${job.title}`,
    text: `A new ${label} job was just posted near you:\n\n"${job.title}"\n${job.locationText}\n\nView and respond:\n${jobUrl}\n\nYou're receiving this because the job matches your trade category and is within 25km of you.`,
    html: `<p>A new <strong>${label}</strong> job was just posted near you:</p><p><strong>${job.title}</strong><br>${job.locationText}</p><p><a href="${jobUrl}">View and respond</a></p><p style="color:#666;font-size:12px;">You're receiving this because the job matches your trade category and is within 25km of you.</p>`,
  });
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail, sendNewJobMatchEmail };
