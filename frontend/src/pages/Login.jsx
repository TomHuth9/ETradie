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
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: null }));
  }

  function handleBlur(e) {
    const { name, value } = e.target;
    if (name === 'email') {
      const msg = validateEmail(value);
      setFieldErrors((prev) => ({ ...prev, email: msg }));
    }
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
      setError(
        err.response?.data?.message || 'Login failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="page-header">
        <h2>Log in</h2>
        <p className="page-subtitle">
          Enter your email and password to access your dashboard.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            className={`form-input ${fieldErrors.email ? 'form-input-error' : ''}`}
            value={form.email}
            onChange={handleChange}
            onBlur={handleBlur}
            required
          />
          {fieldErrors.email && <span className="form-field-error">{fieldErrors.email}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            name="password"
            className={`form-input ${fieldErrors.password ? 'form-input-error' : ''}`}
            value={form.password}
            onChange={handleChange}
            required
          />
          {fieldErrors.password && <span className="form-field-error">{fieldErrors.password}</span>}
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', textAlign: 'center' }}>
        <Link to="/forgot-password">Forgot password?</Link>
      </p>
    </div>
  );
}
