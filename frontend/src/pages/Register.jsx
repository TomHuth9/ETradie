import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  validateName, validateEmail, validatePassword,
  validateAddress, validateTownOrCity, getPasswordHint,
} from '../utils/validation';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'homeowner', address: '', townOrCity: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const isHomeowner = form.role === 'homeowner';

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(p => ({ ...p, [name]: null }));
  }

  function handleBlur(e) {
    const { name, value } = e.target;
    let msg = null;
    if (name === 'name') msg = validateName(value);
    else if (name === 'email') msg = validateEmail(value);
    else if (name === 'password') msg = validatePassword(value);
    else if (name === 'address') msg = validateAddress(value, form.role === 'homeowner');
    else if (name === 'townOrCity') msg = validateTownOrCity(value, form.role === 'tradesperson');
    setFieldErrors(p => msg != null ? { ...p, [name]: msg } : { ...p, [name]: null });
  }

  function validateForm() {
    const errs = {};
    const n = validateName(form.name); if (n) errs.name = n;
    const em = validateEmail(form.email); if (em) errs.email = em;
    const pw = validatePassword(form.password); if (pw) errs.password = pw;
    if (isHomeowner) { const a = validateAddress(form.address, true); if (a) errs.address = a; }
    else { const t = validateTownOrCity(form.townOrCity, true); if (t) errs.townOrCity = t; }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
    setLoading(true);
    try {
      await register(form);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const passwordHint = getPasswordHint(form.password);

  return (
    <div className="auth-layout" style={{ maxWidth: 460 }}>
      <div className="auth-header">
        <h2>Create your account</h2>
        <p className="page-subtitle">Join thousands of homeowners and tradespeople</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="role-cards">
        {[
          { value: 'homeowner',    icon: '🏡', label: 'Homeowner',    sub: 'I need work done' },
          { value: 'tradesperson', icon: '🔧', label: 'Tradesperson', sub: 'I offer services'  },
        ].map(r => (
          <button
            key={r.value}
            type="button"
            className={`role-card${form.role === r.value ? ' selected' : ''}`}
            onClick={() => setForm(p => ({ ...p, role: r.value }))}
          >
            <div className="role-card-icon">{r.icon}</div>
            <div className="role-card-label">{r.label}</div>
            <div className="role-card-sub">{r.sub}</div>
          </button>
        ))}
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full name</label>
            <input id="name" type="text" name="name"
              className={`form-input${fieldErrors.name ? ' form-input-error' : ''}`}
              value={form.name} onChange={handleChange} onBlur={handleBlur} required />
            {fieldErrors.name && <span className="form-field-error">{fieldErrors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input id="email" type="email" name="email"
              className={`form-input${fieldErrors.email ? ' form-input-error' : ''}`}
              placeholder="you@example.com"
              value={form.email} onChange={handleChange} onBlur={handleBlur} required />
            {fieldErrors.email && <span className="form-field-error">{fieldErrors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input id="password" type="password" name="password"
              className={`form-input${fieldErrors.password ? ' form-input-error' : ''}`}
              placeholder="At least 8 characters"
              value={form.password} onChange={handleChange} onBlur={handleBlur} required />
            {passwordHint.message && (
              <span className={`form-hint ${passwordHint.valid ? 'form-hint-valid' : 'form-hint-invalid'}`}>
                {passwordHint.message}
              </span>
            )}
            {fieldErrors.password && <span className="form-field-error">{fieldErrors.password}</span>}
          </div>

          {isHomeowner ? (
            <div className="form-group">
              <label className="form-label" htmlFor="address">Home address</label>
              <input id="address" type="text" name="address"
                className={`form-input${fieldErrors.address ? ' form-input-error' : ''}`}
                placeholder="Full address including postcode"
                value={form.address} onChange={handleChange} onBlur={handleBlur} required />
              {fieldErrors.address && <span className="form-field-error">{fieldErrors.address}</span>}
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label" htmlFor="townOrCity">Town or city</label>
              <input id="townOrCity" type="text" name="townOrCity"
                className={`form-input${fieldErrors.townOrCity ? ' form-input-error' : ''}`}
                placeholder='e.g. "Glasgow"'
                value={form.townOrCity} onChange={handleChange} onBlur={handleBlur} required />
              {fieldErrors.townOrCity && <span className="form-field-error">{fieldErrors.townOrCity}</span>}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 20 }}>
        Already have an account?{' '}
        <Link to="/login" style={{ fontWeight: 600 }}>Log in</Link>
      </p>
    </div>
  );
}
