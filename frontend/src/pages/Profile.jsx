import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', townOrCity: '', availability: true, categories: [] });
  const [categoriesList, setCategoriesList] = useState([]);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/auth/me');
        setProfile(res.data);
        setForm({
          name: res.data.name || '',
          address: res.data.address || '',
          townOrCity: res.data.townOrCity || '',
          availability: res.data.availability !== false,
          categories: res.data.categories || [],
        });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    api.get('/trades/categories').then((res) => setCategoriesList(res.data || [])).catch(() => {});
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
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
              className="form-input"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>
          {user.role === 'HOMEOWNER' && (
            <div className="form-group">
              <label className="form-label" htmlFor="address">Address</label>
              <input
                id="address"
                name="address"
                type="text"
                className="form-input"
                value={form.address}
                onChange={handleChange}
              />
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
                  className="form-input"
                  value={form.townOrCity}
                  onChange={handleChange}
                />
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
              className="form-input"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              className="form-input"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className="form-input"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
              required
            />
          </div>
          <button type="submit" className="btn btn-secondary" disabled={passwordSaving}>
            {passwordSaving ? 'Updating…' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
