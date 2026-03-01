import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { formatJobDate, getStatusBadgeClass } from '../utils/format';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [jobRes, catRes] = await Promise.all([
          api.get(`/jobs/${id}`),
          api.get('/trades/categories').catch(() => ({ data: [] })),
        ]);
        setJob(jobRes.data);
        setCategories(catRes.data);
      } catch (err) {
        setError(err.response?.status === 404 ? 'Job not found.' : err.response?.data?.message || 'Could not load job.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  const categoryLabel = job && categories.length
    ? (categories.find((c) => c.id === job.category)?.label ?? job.category)
    : job?.category ?? '';

  async function handleRespond(response) {
    if (!job || user?.role !== 'TRADESPERSON') return;
    setResponding(true);
    setError('');
    try {
      await api.post(`/jobs/${job.id}/respond`, { response });
      navigate('/tradesperson-dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send response.');
    } finally {
      setResponding(false);
    }
  }

  if (loading) {
    return (
      <div className="page-header">
        <p className="page-subtitle">Loading job…</p>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="page-header">
        <p className="alert alert-error">{error}</p>
        <Link to={user?.role === 'HOMEOWNER' ? '/dashboard' : '/tradesperson-dashboard'} className="btn btn-secondary">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const isHomeowner = user?.role === 'HOMEOWNER';
  const isTradesperson = user?.role === 'TRADESPERSON';
  const canRespond = isTradesperson && job?.status === 'PENDING';

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link
          to={isHomeowner ? '/dashboard' : '/tradesperson-dashboard'}
          className="nav-link"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
        >
          ← Back to dashboard
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>{job.title}</h2>
          <span className={`badge ${getStatusBadgeClass(job.status)}`}>
            {job.status}
          </span>
        </div>

        <div className="card-meta" style={{ marginBottom: '1rem' }}>
          {categoryLabel} · {formatJobDate(job.createdAt)}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <strong className="form-label">Description</strong>
          <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{job.description}</p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <strong className="form-label">Location</strong>
          <p style={{ margin: '0.25rem 0 0' }}>{job.locationText}</p>
        </div>

        {job.homeowner && (
          <div className="card-meta">
            Posted by {job.homeowner.name}
          </div>
        )}

        {canRespond && (
          <div className="job-card-actions" style={{ marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => handleRespond('accepted')}
              disabled={responding}
            >
              {responding ? 'Sending…' : 'Accept job'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => handleRespond('declined')}
              disabled={responding}
            >
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
