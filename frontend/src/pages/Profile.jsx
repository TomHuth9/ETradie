import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  validateName,
  validateAddress,
  validateTownOrCity,
  validatePassword,
  getPasswordHint,
} from '../utils/validation';

export default function Profile() {
  const { user } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', townOrCity: '', availability: true, categories: [] });
  const [categoriesList, setCategoriesList] = useState([]);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    async function load() {
      try {
        const res = await api.get('/auth/me');
        if (cancelled) return;
        setProfile(res.data);
        setForm({
          name: res.data.name || '',
          address: res.data.address || '',
          townOrCity: res.data.townOrCity || '',
          availability: res.data.availability !== false,
          categories: res.data.categories ?? res.data.tradespersonCategories ?? [],
        });
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.message || 'Failed to load profile');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user?.id, location.pathname]);

  useEffect(() => {
    api.get('/trades/categories').then((res) => setCategoriesList(res.data || [])).catch(() => {});
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (profileErrors[name]) setProfileErrors((prev) => ({ ...prev, [name]: null }));
  }

  function handleProfileBlur(e) {
    const { name, value } = e.target;
    let msg = null;
    if (name === 'name') msg = validateName(value);
    else if (name === 'address') msg = validateAddress(value, false);
    else if (name === 'townOrCity') msg = validateTownOrCity(value, false);
    setProfileErrors((prev) => (msg != null ? { ...prev, [name]: msg } : { ...prev, [name]: null }));
  }

  function handleCategoryToggle(catId) {
    setForm((prev) => {
      const list = Array.isArray(prev.categories) ? prev.categories : [];
      const cats = list.includes(catId) ? list.filter((c) => c !== catId) : [...list, catId];
      return { ...prev, categories: cats };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    const n = validateName(form.name); if (n) errs.name = n;
    if (user?.role === 'HOMEOWNER') { const a = validateAddress(form.address, false); if (a) errs.address = a; }
    if (user?.role === 'TRADESPERSON') { const t = validateTownOrCity(form.townOrCity, false); if (t) errs.townOrCity = t; }
    setProfileErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      await api.patch('/auth/profile', {
        name: form.name,
        ...(user?.role === 'HOMEOWNER' && { address: form.address }),
        ...(user?.role === 'TRADESPERSON' && {
          townOrCity: form.townOrCity,
          availability: form.availability,
          categories: form.categories,
        }),
      });
      const res = await api.get('/auth/me');
      setProfile(res.data);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordErrors({});
    const curErr = !passwordForm.currentPassword?.trim() ? 'Current password is required' : null;
    const newErr = validatePassword(passwordForm.newPassword);
    const confErr = passwordForm.newPassword !== passwordForm.confirmPassword ? 'Passwords do not match' : null;
    if (curErr || newErr || confErr) {
      setPasswordErrors({
        currentPassword: curErr || undefined,
        newPassword: newErr || undefined,
        confirmPassword: confErr || undefined,
      });
      return;
    }
    setPasswordSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading || !user) {
    return <div className="page-header"><p>Loading profile…</p></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>Profile</h2>
        <p className="page-subtitle">Update your account details.</p>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0 }}>Edit profile</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Name</label>
            <input
              id="name"
              name="name"
              type="text"
              className={`form-input ${profileErrors.name ? 'form-input-error' : ''}`}
              value={form.name}
              onChange={handleChange}
              onBlur={handleProfileBlur}
              required
            />
            {profileErrors.name && <span className="form-field-error">{profileErrors.name}</span>}
          </div>
          {user.role === 'HOMEOWNER' && (
            <div className="form-group">
              <label className="form-label" htmlFor="address">Address</label>
              <input
                id="address"
                name="address"
                type="text"
                className={`form-input ${profileErrors.address ? 'form-input-error' : ''}`}
                value={form.address}
                onChange={handleChange}
                onBlur={handleProfileBlur}
              />
              {profileErrors.address && <span className="form-field-error">{profileErrors.address}</span>}
            </div>
          )}
          {user.role === 'TRADESPERSON' && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="townOrCity">Town / City</label>
                <input
                  id="townOrCity"
                  name="townOrCity"
                  type="text"
                  className={`form-input ${profileErrors.townOrCity ? 'form-input-error' : ''}`}
                  value={form.townOrCity}
                  onChange={handleChange}
                  onBlur={handleProfileBlur}
                />
                {profileErrors.townOrCity && <span className="form-field-error">{profileErrors.townOrCity}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">
                  <input
                    type="checkbox"
                    name="availability"
                    checked={form.availability}
                    onChange={handleChange}
                  />
                  {' '}Available for new jobs
                </label>
              </div>
              {categoriesList.length > 0 && (
                <div className="form-group">
                  <span className="form-label">Trade categories</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {categoriesList.map((cat) => (
                      <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <input
                          type="checkbox"
                          checked={Array.isArray(form.categories) && form.categories.includes(cat.id)}
                          onChange={() => handleCategoryToggle(cat.id)}
                        />
                        {cat.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Change password</h3>
        <form onSubmit={handlePasswordSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="currentPassword">Current password</label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              className={`form-input ${passwordErrors.currentPassword ? 'form-input-error' : ''}`}
              value={passwordForm.currentPassword}
              onChange={(e) => { setPasswordForm((p) => ({ ...p, currentPassword: e.target.value })); setPasswordErrors((prev) => ({ ...prev, currentPassword: null })); }}
              required
            />
            {passwordErrors.currentPassword && <span className="form-field-error">{passwordErrors.currentPassword}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              className={`form-input ${passwordErrors.newPassword ? 'form-input-error' : ''}`}
              value={passwordForm.newPassword}
              onChange={(e) => { setPasswordForm((p) => ({ ...p, newPassword: e.target.value })); setPasswordErrors((prev) => ({ ...prev, newPassword: null })); }}
              required
            />
            {getPasswordHint(passwordForm.newPassword).message && (
              <span className={`form-hint ${getPasswordHint(passwordForm.newPassword).valid ? 'form-hint-valid' : 'form-hint-invalid'}`}>
                {getPasswordHint(passwordForm.newPassword).message}
              </span>
            )}
            {passwordErrors.newPassword && <span className="form-field-error">{passwordErrors.newPassword}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className={`form-input ${passwordErrors.confirmPassword ? 'form-input-error' : ''}`}
              value={passwordForm.confirmPassword}
              onChange={(e) => { setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value })); setPasswordErrors((prev) => ({ ...prev, confirmPassword: null })); }}
              required
            />
            {passwordErrors.confirmPassword && <span className="form-field-error">{passwordErrors.confirmPassword}</span>}
          </div>
          <button type="submit" className="btn btn-secondary" disabled={passwordSaving}>
            {passwordSaving ? 'Updating…' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
