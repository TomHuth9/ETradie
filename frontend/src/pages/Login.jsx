import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { validateEmail } from '../utils/validation';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(p => ({ ...p, [name]: null }));
  }

  function handleBlur(e) {
    const { name, value } = e.target;
    if (name === 'email') setFieldErrors(p => ({ ...p, email: validateEmail(value) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const emailErr = validateEmail(form.email);
    const passwordErr = !form.password?.trim() ? 'Password is required' : null;
    const errs = {};
    if (emailErr) errs.email = emailErr;
    if (passwordErr) errs.password = passwordErr;
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      await login(form);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-header">
        <h2>Welcome back</h2>
        <p className="page-subtitle">Log in to your etradie account</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email" type="email" name="email"
              className={`form-input${fieldErrors.email ? ' form-input-error' : ''}`}
              placeholder="you@example.com"
              value={form.email} onChange={handleChange} onBlur={handleBlur} required
            />
            {fieldErrors.email && <span className="form-field-error">{fieldErrors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password" type="password" name="password"
              className={`form-input${fieldErrors.password ? ' form-input-error' : ''}`}
              placeholder="••••••••"
              value={form.password} onChange={handleChange} required
            />
            {fieldErrors.password && <span className="form-field-error">{fieldErrors.password}</span>}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginBottom: 12 }}
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div style={{ textAlign: 'center' }}>
          <Link to="/forgot-password" style={{ fontSize: '0.875rem' }}>Forgot password?</Link>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 20 }}>
        No account?{' '}
        <Link to="/register" style={{ fontWeight: 600 }}>Create one free</Link>
      </p>
    </div>
  );
}
