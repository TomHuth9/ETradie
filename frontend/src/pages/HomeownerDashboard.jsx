import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { formatJobDate } from '../utils/format';
import { validateJobTitle, validateJobDescription, validateLocationText } from '../utils/validation';

const CAT_COLORS = {
  PLUMBING:       { color: '#2563eb', bg: '#eff6ff' },
  ELECTRICAL:     { color: '#d97706', bg: '#fffbeb' },
  CARPENTRY:      { color: '#7c3aed', bg: '#f5f3ff' },
  PAINTING:       { color: '#059669', bg: '#ecfdf5' },
  ROOFING:        { color: '#dc2626', bg: '#fef2f2' },
  GARDENING:      { color: '#16a34a', bg: '#f0fdf4' },
  HEATING_GAS:    { color: '#ea580c', bg: '#fff7ed' },
  OTHER_NOT_SURE: { color: '#6b7280', bg: '#f3f4f6' },
};

export default function HomeownerDashboard() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', category: 'OTHER_NOT_SURE', locationText: '' });
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [myJobs, setMyJobs] = useState([]);
  const [myJobsLoading, setMyJobsLoading] = useState(false);
  const [myJobsError, setMyJobsError] = useState('');
  const [myJobsPage, setMyJobsPage] = useState(1);
  const [myJobsTotal, setMyJobsTotal] = useState(0);
  const [myJobsFilterStatus, setMyJobsFilterStatus] = useState('');
  const [myJobsFilterCategory, setMyJobsFilterCategory] = useState('');

  useEffect(() => {
    api.get('/trades/categories')
      .then(res => {
        setCategories(res.data);
        const def = res.data.find(c => c.id === 'OTHER_NOT_SURE')?.id || res.data[0]?.id;
        if (def) setForm(p => ({ ...p, category: def }));
      })
      .catch(err => console.error('Failed to load categories', err));
  }, []);

  useEffect(() => {
    if (user?.address) setForm(p => ({ ...p, locationText: p.locationText || user.address }));
  }, [user?.address]);

  useEffect(() => {
    let cancelled = false;
    setMyJobsLoading(true);
    setMyJobsError('');
    const params = new URLSearchParams();
    params.set('page', String(myJobsPage));
    params.set('limit', '10');
    if (myJobsFilterStatus) params.set('status', myJobsFilterStatus);
    if (myJobsFilterCategory) params.set('category', myJobsFilterCategory);
    api.get(`/jobs/my?${params}`)
      .then(res => {
        if (cancelled) return;
        const data = res.data;
        const list = Array.isArray(data.jobs) ? data.jobs : (Array.isArray(data) ? data : []);
        setMyJobs(prev => myJobsPage === 1 ? list : [...prev, ...list]);
        setMyJobsTotal(typeof data.total === 'number' ? data.total : list.length);
      })
      .catch(err => { if (!cancelled) setMyJobsError(err.response?.data?.message || 'Could not load your jobs.'); })
      .finally(() => { if (!cancelled) setMyJobsLoading(false); });
    return () => { cancelled = true; };
  }, [myJobsPage, myJobsFilterStatus, myJobsFilterCategory]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(p => ({ ...p, [name]: null }));
  }

  function handleBlur(e) {
    const { name, value } = e.target;
    let msg = null;
    if (name === 'title') msg = validateJobTitle(value);
    else if (name === 'description') msg = validateJobDescription(value);
    else if (name === 'locationText') msg = validateLocationText(value);
    setFieldErrors(p => msg != null ? { ...p, [name]: msg } : { ...p, [name]: null });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    const t = validateJobTitle(form.title); if (t) errs.title = t;
    const d = validateJobDescription(form.description); if (d) errs.description = d;
    const l = validateLocationText(form.locationText); if (l) errs.locationText = l;
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitting(true);
    try {
      await api.post('/jobs', form);
      toast.success('Job posted and broadcast to nearby tradespeople.');
      setForm(p => ({ ...p, title: '', description: '' }));
      const res = await api.get('/jobs/my?page=1&limit=10');
      const data = res.data;
      setMyJobs(Array.isArray(data.jobs) ? data.jobs : (Array.isArray(data) ? data : []));
      if (typeof data.total === 'number') setMyJobsTotal(data.total);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create job.');
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = myJobs.filter(j => j.status === 'PENDING').length;
  const activeCount = myJobs.filter(j => j.status === 'ACCEPTED').length;

  return (
    <div>
      <div className="dashboard-welcome">
        <div>
          <h2>Good to see you{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋</h2>
          <p className="page-subtitle">Post a new job or track your existing requests.</p>
        </div>
        <div className="stats-row">
          <div className="stat-item">
            <div className="stat-n">{myJobs.length}</div>
            <div className="stat-label">Total jobs</div>
          </div>
          <div className="stat-item">
            <div className="stat-n">{pendingCount}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-item">
            <div className="stat-n">{activeCount}</div>
            <div className="stat-label">Active</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.25rem' }}>Post a new job</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="title">Job title</label>
                <input id="title" type="text" name="title"
                  className={`form-input${fieldErrors.title ? ' form-input-error' : ''}`}
                  placeholder="e.g. Fix leaking radiator"
                  value={form.title} onChange={handleChange} onBlur={handleBlur} required />
                {fieldErrors.title && <span className="form-field-error">{fieldErrors.title}</span>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="category">Trade category</label>
              <select id="category" name="category" className="form-select"
                value={form.category} onChange={handleChange} required>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="locationText">Job location</label>
              <input id="locationText" type="text" name="locationText"
                className={`form-input${fieldErrors.locationText ? ' form-input-error' : ''}`}
                placeholder="Address or postcode"
                value={form.locationText} onChange={handleChange} onBlur={handleBlur} required />
              {fieldErrors.locationText && <span className="form-field-error">{fieldErrors.locationText}</span>}
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" htmlFor="description">Description</label>
              <textarea id="description" name="description" rows={3}
                className={`form-textarea${fieldErrors.description ? ' form-input-error' : ''}`}
                placeholder="Describe the job in detail…"
                value={form.description} onChange={handleChange} onBlur={handleBlur} required />
              {fieldErrors.description && <span className="form-field-error">{fieldErrors.description}</span>}
            </div>
          </div>

          <button type="submit" className="btn btn-cta" disabled={submitting}>
            {submitting ? 'Posting job…' : 'Post job'}
          </button>
        </form>
      </div>

      <section className="section">
        <div className="section-header">
          <h3 className="section-title">Your jobs</h3>
          <select className="form-select" value={myJobsFilterStatus}
            onChange={e => { setMyJobsFilterStatus(e.target.value); setMyJobsPage(1); }}
            style={{ width: 'auto', minWidth: 140 }}>
            <option value="">All statuses</option>
            {['PENDING','ACCEPTED','COMPLETED','CANCELLED','CLOSED'].map(s => (
              <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>
            ))}
          </select>
          <select className="form-select" value={myJobsFilterCategory}
            onChange={e => { setMyJobsFilterCategory(e.target.value); setMyJobsPage(1); }}
            style={{ width: 'auto', minWidth: 180 }}>
            <option value="">All categories</option>
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
          </select>
        </div>

        {myJobsLoading && myJobsPage === 1 && <p className="page-subtitle">Loading your jobs…</p>}
        {myJobsError && <div className="alert alert-error">{myJobsError}</div>}

        {!myJobsLoading && !myJobsError && myJobs.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No jobs yet</div>
            <div className="empty-state-body">Post your first job above and get matched with a local tradesperson.</div>
          </div>
        )}

        {myJobs.length > 0 && (
          <>
            <div className="job-list">
              {myJobs.map(job => {
                const cat = CAT_COLORS[job.category] || CAT_COLORS.OTHER_NOT_SURE;
                const tp = job.responses?.[0]?.tradesperson;
                return (
                  <Link key={job.id} to={`/jobs/${job.id}`} className="card-link">
                    <div className="job-card">
                      <div className="job-card-header">
                        <div>
                          <div className="job-card-title">{job.title}</div>
                          <div className="job-card-meta">
                            <span className="cat-pill" style={{ background: cat.bg, color: cat.color }}>
                              {categories.find(c => c.id === job.category)?.label || job.category}
                            </span>
                            <span>📍 {job.locationText}</span>
                            <span>{formatJobDate(job.createdAt)}</span>
                            {tp && (
                              <span>
                                · Accepted by{' '}
                                <Link to={`/profile/${tp.id}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                                  {tp.name}
                                </Link>
                                {tp.averageRating != null && <> ⭐ {tp.averageRating}</>}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`badge badge-${job.status.toLowerCase()}`}>{job.status}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            {myJobsTotal > myJobs.length && (
              <button type="button" className="btn btn-secondary" style={{ marginTop: '1rem' }}
                onClick={() => setMyJobsPage(p => p + 1)} disabled={myJobsLoading}>
                {myJobsLoading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
