import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { validatePassword, getPasswordHint } from '../utils/validation';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const passwordHint = getPasswordHint(password);

  async function handleSubmit(e) {
    e.preventDefault();
    setPasswordError('');
    setConfirmError('');
    const pwErr = validatePassword(password);
    if (pwErr) { setPasswordError(pwErr); return; }
    if (password !== confirm) { setConfirmError('Passwords do not match'); return; }
    if (!token) { toast.error('Invalid reset link'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
      toast.success('Password reset. You can log in now.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="auth-layout">
        <div className="page-header">
          <h2>Password reset</h2>
          <p className="page-subtitle">Your password has been updated.</p>
          <Link to="/login" className="btn btn-primary">Log in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <div className="page-header">
        <h2>Set new password</h2>
        <p className="page-subtitle">Enter your new password below.</p>
      </div>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label className="form-label" htmlFor="password">New password</label>
          <input
            id="password"
            type="password"
            className={`form-input ${passwordError ? 'form-input-error' : ''}`}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
            required
            minLength={8}
          />
          {passwordHint.message && (
            <span className={`form-hint ${passwordHint.valid ? 'form-hint-valid' : 'form-hint-invalid'}`}>
              {passwordHint.message}
            </span>
          )}
          {passwordError && <span className="form-field-error">{passwordError}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            type="password"
            className={`form-input ${confirmError ? 'form-input-error' : ''}`}
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setConfirmError(''); }}
            required
          />
          {confirmError && <span className="form-field-error">{confirmError}</span>}
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading || !token}>
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        <Link to="/login">Back to login</Link>
      </p>
    </div>
  );
}
