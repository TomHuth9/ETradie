import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  validateName, validateEmail, validatePassword,
  validateAddressLine1, validateAddressLine2, validateAddressCity, validateAddressPostcode,
  validateTownOrCity, getPasswordHint,
} from '../utils/validation';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'homeowner',
    addressLine1: '', addressLine2: '', addressCity: '', addressPostcode: '',
    townOrCity: '',
  });
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
    else if (name === 'addressLine1') msg = validateAddressLine1(value, isHomeowner);
    else if (name === 'addressLine2') msg = validateAddressLine2(value);
    else if (name === 'addressCity') msg = validateAddressCity(value, isHomeowner);
    else if (name === 'addressPostcode') msg = validateAddressPostcode(value, isHomeowner);
    else if (name === 'townOrCity') msg = validateTownOrCity(value, form.role === 'tradesperson');
    setFieldErrors(p => msg != null ? { ...p, [name]: msg } : { ...p, [name]: null });
  }

  function validateForm() {
    const errs = {};
    const n = validateName(form.name); if (n) errs.name = n;
    const em = validateEmail(form.email); if (em) errs.email = em;
    const pw = validatePassword(form.password); if (pw) errs.password = pw;
    if (isHomeowner) {
      const l1 = validateAddressLine1(form.addressLine1, true); if (l1) errs.addressLine1 = l1;
      const l2 = validateAddressLine2(form.addressLine2); if (l2) errs.addressLine2 = l2;
      const c = validateAddressCity(form.addressCity, true); if (c) errs.addressCity = c;
      const p = validateAddressPostcode(form.addressPostcode, true); if (p) errs.addressPostcode = p;
    } else {
      const t = validateTownOrCity(form.townOrCity, true); if (t) errs.townOrCity = t;
    }
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
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="addressLine1">Address line 1</label>
                <input id="addressLine1" type="text" name="addressLine1"
                  className={`form-input${fieldErrors.addressLine1 ? ' form-input-error' : ''}`}
                  placeholder="House number and street"
                  value={form.addressLine1} onChange={handleChange} onBlur={handleBlur} required />
                {fieldErrors.addressLine1 && <span className="form-field-error">{fieldErrors.addressLine1}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="addressLine2">Address line 2 (optional)</label>
                <input id="addressLine2" type="text" name="addressLine2"
                  className={`form-input${fieldErrors.addressLine2 ? ' form-input-error' : ''}`}
                  placeholder="Flat, apartment, etc."
                  value={form.addressLine2} onChange={handleChange} onBlur={handleBlur} />
                {fieldErrors.addressLine2 && <span className="form-field-error">{fieldErrors.addressLine2}</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="addressCity">Town / City</label>
                  <input id="addressCity" type="text" name="addressCity"
                    className={`form-input${fieldErrors.addressCity ? ' form-input-error' : ''}`}
                    placeholder='e.g. "Glasgow"'
                    value={form.addressCity} onChange={handleChange} onBlur={handleBlur} required />
                  {fieldErrors.addressCity && <span className="form-field-error">{fieldErrors.addressCity}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="addressPostcode">Postcode</label>
                  <input id="addressPostcode" type="text" name="addressPostcode"
                    className={`form-input${fieldErrors.addressPostcode ? ' form-input-error' : ''}`}
                    placeholder="G2 1AL"
                    value={form.addressPostcode} onChange={handleChange} onBlur={handleBlur} required />
                  {fieldErrors.addressPostcode && <span className="form-field-error">{fieldErrors.addressPostcode}</span>}
                </div>
              </div>
            </>
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
