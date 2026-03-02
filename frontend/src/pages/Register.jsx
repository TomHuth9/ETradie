import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  validateName,
  validateEmail,
  validatePassword,
  validateAddress,
  validateTownOrCity,
  getPasswordHint,
} from '../utils/validation';

export default function Register() {
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'homeowner',
    address: '',
    townOrCity: '',
  });
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
    let msg = null;
    if (name === 'name') msg = validateName(value);
    else if (name === 'email') msg = validateEmail(value);
    else if (name === 'password') msg = validatePassword(value);
    else if (name === 'address') msg = validateAddress(value, form.role === 'homeowner');
    else if (name === 'townOrCity') msg = validateTownOrCity(value, form.role === 'tradesperson');
    setFieldErrors((prev) => (msg != null ? { ...prev, [name]: msg } : { ...prev, [name]: null }));
  }

  function validateForm() {
    const errs = {};
    const n = validateName(form.name); if (n) errs.name = n;
    const em = validateEmail(form.email); if (em) errs.email = em;
    const pw = validatePassword(form.password); if (pw) errs.password = pw;
    if (form.role === 'homeowner') { const a = validateAddress(form.address, true); if (a) errs.address = a; }
    if (form.role === 'tradesperson') { const t = validateTownOrCity(form.townOrCity, true); if (t) errs.townOrCity = t; }
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
      setError(
        err.response?.data?.message || 'Registration failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  const passwordHint = getPasswordHint(form.password);

  const isHomeowner = form.role === 'homeowner';

  return (
    <div className="auth-layout">
      <div className="page-header">
        <h2>Create an account</h2>
        <p className="page-subtitle">
          Choose whether you are a homeowner looking for help or a tradesperson
          offering services.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label className="form-label" htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            name="name"
            className={`form-input ${fieldErrors.name ? 'form-input-error' : ''}`}
            value={form.name}
            onChange={handleChange}
            onBlur={handleBlur}
            required
          />
          {fieldErrors.name && <span className="form-field-error">{fieldErrors.name}</span>}
        </div>
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
            onBlur={handleBlur}
            required
          />
          {passwordHint.message && (
            <span className={`form-hint ${passwordHint.valid ? 'form-hint-valid' : 'form-hint-invalid'}`}>
              {passwordHint.message}
            </span>
          )}
          {fieldErrors.password && <span className="form-field-error">{fieldErrors.password}</span>}
        </div>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">I am a...</legend>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="role"
                value="homeowner"
                checked={form.role === 'homeowner'}
                onChange={handleChange}
              />
              Homeowner
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="role"
                value="tradesperson"
                checked={form.role === 'tradesperson'}
                onChange={handleChange}
              />
              Tradesperson
            </label>
          </div>
        </fieldset>

        {isHomeowner ? (
          <div className="form-group">
            <label className="form-label" htmlFor="address">Home address</label>
            <input
              id="address"
              type="text"
              name="address"
              className={`form-input ${fieldErrors.address ? 'form-input-error' : ''}`}
              placeholder="Full address including postcode"
              value={form.address}
              onChange={handleChange}
              onBlur={handleBlur}
              required
            />
            {fieldErrors.address && <span className="form-field-error">{fieldErrors.address}</span>}
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label" htmlFor="townOrCity">Town or city</label>
            <input
              id="townOrCity"
              type="text"
              name="townOrCity"
              className={`form-input ${fieldErrors.townOrCity ? 'form-input-error' : ''}`}
              placeholder='e.g. "Glasgow"'
              value={form.townOrCity}
              onChange={handleChange}
              onBlur={handleBlur}
              required
            />
            {fieldErrors.townOrCity && <span className="form-field-error">{fieldErrors.townOrCity}</span>}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Creating account...' : 'Register'}
        </button>
      </form>
    </div>
  );
}
