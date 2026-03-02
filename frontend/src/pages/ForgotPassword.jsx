import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { validateEmail } from '../utils/validation';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validateEmail(email);
    setEmailError(err || '');
    if (err) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
      toast.success('If that email exists, we sent a reset link.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-layout">
        <div className="page-header">
          <h2>Check your email</h2>
          <p className="page-subtitle">
            If an account exists for that email, we sent a password reset link.
          </p>
          <Link to="/login" className="btn btn-primary">Back to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <div className="page-header">
        <h2>Forgot password</h2>
        <p className="page-subtitle">Enter your email and we’ll send a reset link.</p>
      </div>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className={`form-input ${emailError ? 'form-input-error' : ''}`}
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
            required
          />
          {emailError && <span className="form-field-error">{emailError}</span>}
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        <Link to="/login">Back to login</Link>
      </p>
    </div>
  );
}
