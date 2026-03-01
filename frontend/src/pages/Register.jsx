import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
  const [passwordHint, setPasswordHint] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (name === 'password') {
      const pwd = value;
      if (!pwd) {
        setPasswordHint('');
      } else if (pwd.length < 8) {
        setPasswordHint('Use at least 8 characters.');
      } else if (!/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
        setPasswordHint(
          'Include at least one uppercase letter, one lowercase letter, and one number.'
        );
      } else {
        setPasswordHint('Looks good.');
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
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
            className="form-input"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            className="form-input"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            name="password"
            className="form-input"
            value={form.password}
            onChange={handleChange}
            required
          />
          {passwordHint && (
            <span
              className={`form-hint ${passwordHint === 'Looks good.' ? 'form-hint-valid' : 'form-hint-invalid'}`}
            >
              {passwordHint}
            </span>
          )}
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
              className="form-input"
              placeholder="Full address including postcode"
              value={form.address}
              onChange={handleChange}
              required
            />
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label" htmlFor="townOrCity">Town or city</label>
            <input
              id="townOrCity"
              type="text"
              name="townOrCity"
              className="form-input"
              placeholder='e.g. "Glasgow"'
              value={form.townOrCity}
              onChange={handleChange}
              required
            />
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Creating account...' : 'Register'}
        </button>
      </form>
    </div>
  );
}
