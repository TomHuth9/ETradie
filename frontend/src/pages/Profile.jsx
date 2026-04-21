import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { validateName, validateAddress, validateTownOrCity, validatePassword, getPasswordHint } from '../utils/validation';

export default function Profile() {
  const { user } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', townOrCity: '', availability: true, workingHours: '', categories: [] });
  const [categoriesList, setCategoriesList] = useState([]);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  const isTrade = user?.role === 'TRADESPERSON';

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    api.get('/auth/me')
      .then(res => {
        if (cancelled) return;
        setProfile(res.data);
        setForm({
          name: res.data.name || '',
          address: res.data.address || '',
          townOrCity: res.data.townOrCity || '',
          availability: res.data.availability !== false,
          workingHours: res.data.workingHours || '',
          categories: res.data.categories ?? res.data.tradespersonCategories ?? [],
        });
      })
      .catch(err => { if (!cancelled) toast.error(err.response?.data?.message || 'Failed to load profile'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, location.pathname]);

  useEffect(() => {
    api.get('/trades/categories').then(res => setCategoriesList(res.data || [])).catch(() => {});
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    if (profileErrors[name]) setProfileErrors(p => ({ ...p, [name]: null }));
  }

  function handleBlur(e) {
    const { name, value } = e.target;
    let msg = null;
    if (name === 'name') msg = validateName(value);
    else if (name === 'address') msg = validateAddress(value, false);
    else if (name === 'townOrCity') msg = validateTownOrCity(value, false);
    setProfileErrors(p => msg != null ? { ...p, [name]: msg } : { ...p, [name]: null });
  }

  function handleCategoryToggle(catId) {
    setForm(p => {
      const list = Array.isArray(p.categories) ? p.categories : [];
      return { ...p, categories: list.includes(catId) ? list.filter(c => c !== catId) : [...list, catId] };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    const n = validateName(form.name); if (n) errs.name = n;
    if (!isTrade) { const a = validateAddress(form.address, false); if (a) errs.address = a; }
    if (isTrade)  { const t = validateTownOrCity(form.townOrCity, false); if (t) errs.townOrCity = t; }
    setProfileErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      await api.patch('/auth/profile', {
        name: form.name,
        ...(!isTrade && { address: form.address }),
        ...(isTrade && { townOrCity: form.townOrCity, availability: form.availability, workingHours: form.workingHours, categories: form.categories }),
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
    const curErr  = !passwordForm.currentPassword?.trim() ? 'Current password is required' : null;
    const newErr  = validatePassword(passwordForm.newPassword);
    const confErr = passwordForm.newPassword !== passwordForm.confirmPassword ? 'Passwords do not match' : null;
    if (curErr || newErr || confErr) { setPasswordErrors({ currentPassword: curErr, newPassword: newErr, confirmPassword: confErr }); return; }
    setPasswordSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading || !user) return <div className="page-header"><p className="page-subtitle">Loading profile…</p></div>;

  return (
    <div>
      <div style={{ paddingTop: '2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.375rem', flexShrink: 0 }}>
          {form.name ? form.name[0].toUpperCase() : '?'}
        </div>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: '1.5rem' }}>{form.name || 'Your profile'}</h2>
          <p className="page-subtitle" style={{ margin: 0, fontSize: '0.875rem' }}>
            {isTrade ? 'Tradesperson' : 'Homeowner'} · {profile?.email}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1.0625rem' }}>Edit profile</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pname">Full name</label>
                <input id="pname" name="name" type="text"
                  className={`form-input${profileErrors.name ? ' form-input-error' : ''}`}
                  value={form.name} onChange={handleChange} onBlur={handleBlur} required />
                {profileErrors.name && <span className="form-field-error">{profileErrors.name}</span>}
              </div>
            </div>

            {!isTrade && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="paddr">Address</label>
                  <input id="paddr" name="address" type="text"
                    className={`form-input${profileErrors.address ? ' form-input-error' : ''}`}
                    value={form.address} onChange={handleChange} onBlur={handleBlur} />
                  {profileErrors.address && <span className="form-field-error">{profileErrors.address}</span>}
                </div>
              </div>
            )}

            {isTrade && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="ptownOrCity">Town / City</label>
                  <input id="ptownOrCity" name="townOrCity" type="text"
                    className={`form-input${profileErrors.townOrCity ? ' form-input-error' : ''}`}
                    value={form.townOrCity} onChange={handleChange} onBlur={handleBlur} />
                  {profileErrors.townOrCity && <span className="form-field-error">{profileErrors.townOrCity}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pwh">Standard working hours</label>
                  <input id="pwh" name="workingHours" type="text"
                    className="form-input" placeholder="e.g. Mon–Fri 09:00–17:00"
                    value={form.workingHours} onChange={handleChange} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">
                    <input type="checkbox" name="availability" checked={form.availability}
                      onChange={handleChange} style={{ marginRight: 8, width: 16, height: 16, accentColor: 'var(--color-primary)', verticalAlign: 'middle' }} />
                    Available for new jobs
                  </label>
                </div>
              </>
            )}
          </div>

          {isTrade && categoriesList.length > 0 && (
            <div className="form-group">
              <span className="form-label">Trade categories</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {categoriesList.map(cat => (
                  <button key={cat.id} type="button"
                    className={`cat-chip${Array.isArray(form.categories) && form.categories.includes(cat.id) ? ' selected' : ''}`}
                    onClick={() => handleCategoryToggle(cat.id)}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 20px', fontSize: '1.0625rem' }}>Change password</h3>
        <form onSubmit={handlePasswordSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="curpw">Current password</label>
            <input id="curpw" name="currentPassword" type="password"
              className={`form-input${passwordErrors.currentPassword ? ' form-input-error' : ''}`}
              value={passwordForm.currentPassword}
              onChange={e => { setPasswordForm(p => ({ ...p, currentPassword: e.target.value })); setPasswordErrors(p => ({ ...p, currentPassword: null })); }}
              required />
            {passwordErrors.currentPassword && <span className="form-field-error">{passwordErrors.currentPassword}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="newpw">New password</label>
            <input id="newpw" name="newPassword" type="password"
              className={`form-input${passwordErrors.newPassword ? ' form-input-error' : ''}`}
              value={passwordForm.newPassword}
              onChange={e => { setPasswordForm(p => ({ ...p, newPassword: e.target.value })); setPasswordErrors(p => ({ ...p, newPassword: null })); }}
              required />
            {getPasswordHint(passwordForm.newPassword).message && (
              <span className={`form-hint ${getPasswordHint(passwordForm.newPassword).valid ? 'form-hint-valid' : 'form-hint-invalid'}`}>
                {getPasswordHint(passwordForm.newPassword).message}
              </span>
            )}
            {passwordErrors.newPassword && <span className="form-field-error">{passwordErrors.newPassword}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="confpw">Confirm new password</label>
            <input id="confpw" name="confirmPassword" type="password"
              className={`form-input${passwordErrors.confirmPassword ? ' form-input-error' : ''}`}
              value={passwordForm.confirmPassword}
              onChange={e => { setPasswordForm(p => ({ ...p, confirmPassword: e.target.value })); setPasswordErrors(p => ({ ...p, confirmPassword: null })); }}
              required />
            {passwordErrors.confirmPassword && <span className="form-field-error">{passwordErrors.confirmPassword}</span>}
          </div>
          <button type="submit" className="btn btn-ghost" disabled={passwordSaving}>
            {passwordSaving ? 'Updating…' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
