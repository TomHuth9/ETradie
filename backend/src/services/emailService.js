const sgMail = require('@sendgrid/mail');

async function sendPasswordResetEmail(to, token) {
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
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  await sgMail.send({
    to,
    from: process.env.FROM_EMAIL,
    subject: 'Verify your ETradie email address',
    text: `Your ETradie verification code is: ${code}\n\nEnter this code to finish creating your account. It expires in 15 minutes.\n\nIf you didn't create an account, ignore this email.`,
    html: `<p>Your ETradie verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p><p>Enter this code to finish creating your account. It expires in 15 minutes.</p><p>If you didn't create an account, ignore this email.</p>`,
  });
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail };
