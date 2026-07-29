import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { validateEmail } from '../utils/validation';

export default function VerifyEmail() {
  const { verifyEmail, resendVerification } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the 6-digit code from your email'); return; }
    setLoading(true);
    try {
      await verifyEmail(email.trim().toLowerCase(), code.trim());
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }
    setError('');
    setResending(true);
    try {
      await resendVerification(email.trim().toLowerCase());
      toast.success('If that account needs verifying, a new code is on its way.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-header">
        <h2>Verify your email</h2>
        <p className="page-subtitle">
          Enter the 6-digit code we emailed to {email ? <strong>{email}</strong> : 'your address'} to activate your account.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email" type="email" name="email"
              className="form-input"
              placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="code">Verification code</label>
            <input
              id="code" type="text" name="code" inputMode="numeric" autoComplete="one-time-code"
              className="form-input"
              placeholder="123456" maxLength={6}
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginBottom: 12 }}
          >
            {loading ? 'Verifying…' : 'Verify email'}
          </button>
        </form>

        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--color-primary)', fontWeight: 500 }}
          >
            {resending ? 'Sending…' : "Didn't get a code? Resend"}
          </button>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 20 }}>
        <Link to="/login" style={{ fontWeight: 600 }}>Back to log in</Link>
      </p>
    </div>
  );
}
