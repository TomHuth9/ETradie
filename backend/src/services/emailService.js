const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendPasswordResetEmail(to, token) {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  await sgMail.send({
    to,
    from: process.env.FROM_EMAIL,
    subject: 'Reset your ETradie password',
    text: `You requested a password reset. Click the link below to set a new password (expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    html: `<p>You requested a password reset. Click below to set a new password (expires in 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore this email.</p>`,
  });
}

module.exports = { sendPasswordResetEmail };
