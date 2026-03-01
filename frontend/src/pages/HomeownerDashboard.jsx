import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { formatJobDate, getStatusBadgeClass } from '../utils/format';

export default function HomeownerDashboard() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'OTHER_NOT_SURE',
    locationText: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [myJobs, setMyJobs] = useState([]);
  const [myJobsLoading, setMyJobsLoading] = useState(false);
  const [myJobsError, setMyJobsError] = useState('');

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await api.get('/trades/categories');
        setCategories(res.data);
        const defaultCat =
          res.data.find((c) => c.id === 'OTHER_NOT_SURE')?.id ||
          res.data[0]?.id;
        if (defaultCat) {
          setForm((prev) => ({ ...prev, category: defaultCat }));
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    }

    loadCategories();
  }, []);

  const [myJobsPage, setMyJobsPage] = useState(1);
  const [myJobsTotal, setMyJobsTotal] = useState(0);
  const [myJobsFilterStatus, setMyJobsFilterStatus] = useState('');
  const [myJobsFilterCategory, setMyJobsFilterCategory] = useState('');

  useEffect(() => {
    async function loadMyJobs() {
      setMyJobsLoading(true);
      setMyJobsError('');
      try {
        const params = new URLSearchParams();
        params.set('page', String(myJobsPage));
        params.set('limit', '10');
        if (myJobsFilterStatus) params.set('status', myJobsFilterStatus);
        if (myJobsFilterCategory) params.set('category', myJobsFilterCategory);
        const res = await api.get(`/jobs/my?${params.toString()}`);
        const data = res.data;
        const list = Array.isArray(data.jobs) ? data.jobs : (Array.isArray(data) ? data : []);
        setMyJobs((prev) => (myJobsPage === 1 ? list : [...prev, ...list]));
        setMyJobsTotal(typeof data.total === 'number' ? data.total : list.length);
      } catch (err) {
        setMyJobsError(
          err.response?.data?.message || 'Could not load your jobs right now.'
        );
      } finally {
        setMyJobsLoading(false);
      }
    }

    loadMyJobs();
  }, [myJobsPage, myJobsFilterStatus, myJobsFilterCategory]);

  useEffect(() => {
    if (user?.address) {
      setForm((prev) => ({
        ...prev,
        locationText: prev.locationText || user.address,
      }));
    }
  }, [user?.address]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      await api.post('/jobs', form);
      toast.success('Job posted and broadcast to nearby tradespeople.');
      setMessage('Job posted and broadcast to nearby tradespeople.');
      setForm((prev) => ({
        ...prev,
        title: '',
        description: '',
      }));
      try {
        const res = await api.get('/jobs/my?page=1&limit=10');
        const data = res.data;
        setMyJobs(Array.isArray(data.jobs) ? data.jobs : (Array.isArray(data) ? data : []));
        if (typeof data.total === 'number') setMyJobsTotal(data.total);
      } catch {
        // ignore
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to create job. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Homeowner dashboard</h2>
        <p className="page-subtitle">
          Post a new job request to nearby tradespeople.
        </p>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Post a job</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="title">Title</label>
            <input
              id="title"
              type="text"
              name="title"
              className="form-input"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Fix leaking radiator"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              className="form-textarea"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe the job in detail..."
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="category">Trade category</label>
            <select
              id="category"
              name="category"
              className="form-select"
              value={form.category}
              onChange={handleChange}
              required
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="locationText">Job location</label>
            <input
              id="locationText"
              type="text"
              name="locationText"
              className="form-input"
              value={form.locationText}
              onChange={handleChange}
              placeholder="Will default to your saved address, but you can edit it"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Posting job...' : 'Post job'}
          </button>
        </form>
      </div>

      <section className="section">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <h3 className="section-title" style={{ marginBottom: 0 }}>Your jobs</h3>
          <select
            className="form-select"
            value={myJobsFilterStatus}
            onChange={(e) => { setMyJobsFilterStatus(e.target.value); setMyJobsPage(1); }}
            style={{ width: 'auto', minWidth: '140px' }}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="CLOSED">Closed</option>
          </select>
          <select
            className="form-select"
            value={myJobsFilterCategory}
            onChange={(e) => { setMyJobsFilterCategory(e.target.value); setMyJobsPage(1); }}
            style={{ width: 'auto', minWidth: '180px' }}
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
        </div>
        {myJobsLoading && (
          <p className="page-subtitle">Loading your jobs…</p>
        )}
        {myJobsError && (
          <p className="alert alert-error">{myJobsError}</p>
        )}
        {!myJobsLoading && !myJobsError && myJobs.length === 0 && (
          <div className="empty-state">
            You have not posted any jobs yet.
          </div>
        )}
        {!myJobsLoading && !myJobsError && myJobs.length > 0 && (
          <>
            <div className="job-list">
              {myJobs.map((job) => {
                const acceptedBy = job.responses?.[0]?.tradesperson;
                const name = acceptedBy?.name;
                const rating = acceptedBy?.averageRating;
                const reviewCount = acceptedBy?.reviewCount;
                return (
                  <Link key={job.id} to={`/jobs/${job.id}`} className="card-link">
                    <div className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <strong className="card-title">{job.title}</strong>
                        <span className={`badge ${getStatusBadgeClass(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                      <div className="card-meta">{job.locationText}</div>
                      <div className="card-meta">
                        {formatJobDate(job.createdAt)}
                        {name && (
                          <>
                            {' · Accepted by '}
                            <Link to={`/profile/${acceptedBy.id}`} onClick={(e) => e.stopPropagation()} className="card-meta-link">
                              <strong>{name}</strong>
                              {rating != null && (
                                <span> ★ {rating}{reviewCount != null ? ` (${reviewCount})` : ''}</span>
                              )}
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            {myJobsTotal > myJobs.length && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: '1rem' }}
                onClick={() => setMyJobsPage((p) => p + 1)}
                disabled={myJobsLoading}
              >
                {myJobsLoading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
