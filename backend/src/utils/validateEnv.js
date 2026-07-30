// Fails fast with a clear message if required config is missing, instead of
// starting "successfully" and only failing later with a confusing error on
// the first request that needs it (e.g. a raw JWT-sign failure, or a Prisma
// connection error hidden behind the generic 500 message in production).
const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];

// Missing these doesn't break the app outright — each already degrades
// gracefully in code (email sends are wrapped in try/catch; CORS/CLIENT_URL
// falls back to localhost) — but the resulting behavior is easy to mistake
// for a bug, so warn loudly rather than fail silently.
const RECOMMENDED = ['SENDGRID_API_KEY', 'FROM_EMAIL', 'CLIENT_URL'];

function validateEnv() {
  const missingRequired = REQUIRED.filter((key) => !process.env[key]);
  if (missingRequired.length > 0) {
    console.error(
      `Missing required environment variable(s): ${missingRequired.join(', ')}. ` +
      'The server cannot start without these — set them in your .env file (local) or ' +
      'in the environment settings of your host (e.g. the Render dashboard).'
    );
    process.exit(1);
  }

  const missingRecommended = RECOMMENDED.filter((key) => !process.env[key]);
  if (missingRecommended.length > 0) {
    console.warn(
      `Missing recommended environment variable(s): ${missingRecommended.join(', ')}. ` +
      'The server will still start, but related features will be degraded ' +
      '(e.g. emails will silently fail to send, or CORS will fall back to localhost).'
    );
  }

  // A key that's present but malformed (wrong value pasted, a revoked key
  // swapped back in, etc.) otherwise fails silently on the first send —
  // emailService catches and only console.errors it per-request. Catching
  // the obvious shape mistake at boot makes it show up once, loudly, in the
  // deploy logs instead of getting buried in per-request noise.
  if (process.env.SENDGRID_API_KEY && !process.env.SENDGRID_API_KEY.startsWith('SG.')) {
    console.warn(
      'SENDGRID_API_KEY does not look like a valid SendGrid key (should start with "SG."). ' +
      'Emails will fail to send until this is corrected in your host\'s environment settings.'
    );
  }
}

module.exports = { validateEnv };
