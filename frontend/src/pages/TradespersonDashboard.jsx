import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import JobCard from '../components/JobCard';
import { formatJobDate, getStatusBadgeClass } from '../utils/format';

export default function TradespersonDashboard() {
  const { socket, isSocketConnected } = useAuth();
  const connectionLabel = !socket ? 'Connecting…' : isSocketConnected ? 'Live — receiving job requests' : 'Reconnecting…';
  const [jobs, setJobs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [busyJobId, setBusyJobId] = useState(null);
  const [error, setError] = useState('');
  const [historyJobs, setHistoryJobs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const categoryMap = useMemo(
    () =>
      categories.reduce((acc, cat) => {
        acc[cat.id] = cat.label;
        return acc;
      }, {}),
    [categories]
  );

  const filteredJobs = useMemo(() => {
    if (!categoryFilter) return jobs;
    return jobs.filter((j) => j.category === categoryFilter);
  }, [jobs, categoryFilter]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await api.get('/trades/categories');
        setCategories(res.data);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    }

    loadCategories();
  }, []);

  useEffect(() => {
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError('');
      try {
        const res = await api.get('/jobs/my');
        setHistoryJobs(res.data);
      } catch (err) {
        setHistoryError(
          err.response?.data?.message ||
            'Could not load your recent jobs right now.'
        );
      } finally {
        setHistoryLoading(false);
      }
    }

    loadHistory();
  }, []);

  useEffect(() => {
    if (!socket) return;

    function handleNewJob(job) {
      setJobs((prev) => {
        const exists = prev.some((j) => j.id === job.id);
        if (exists) return prev;
        return [job, ...prev];
      });
    }

    socket.on('job:new', handleNewJob);

    return () => {
      socket.off('job:new', handleNewJob);
    };
  }, [socket]);

  async function respond(jobId, response) {
    setBusyJobId(jobId);
    setError('');
    try {
      await api.post(`/jobs/${jobId}/respond`, { response });
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      try {
        const res = await api.get('/jobs/my');
        setHistoryJobs(res.data);
      } catch {
        // ignore
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Failed to send response. Please try again.'
      );
    } finally {
      setBusyJobId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Tradesperson dashboard</h2>
        <p className="page-subtitle">
          When homeowners near you post new jobs, they will appear here in real time.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className={`connection-status ${isSocketConnected ? 'connected' : 'disconnected'}`} style={{ marginBottom: '1rem' }}>
        <span className="connection-status-dot" />
        {connectionLabel}
      </div>

      <section className="section">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <h3 className="section-title" style={{ marginBottom: 0 }}>New job requests</h3>
          {categories.length > 0 && (
            <select
              className="form-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: 'auto', minWidth: '180px' }}
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          )}
        </div>
        {filteredJobs.length === 0 && (
          <div className="empty-state">
            {jobs.length === 0
              ? 'No new jobs yet. Keep this page open to receive real-time requests.'
              : `No jobs in this category. ${categoryFilter ? 'Try "All categories".' : ''}`}
          </div>
        )}
        {filteredJobs.length > 0 && (
          <div className="job-list">
            {filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={{
                  ...job,
                  categoryLabel: categoryMap[job.category],
                }}
                accepting={busyJobId === job.id}
                declining={busyJobId === job.id}
                onAccept={() => respond(job.id, 'accepted')}
                onDecline={() => respond(job.id, 'declined')}
                isNew
              />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h3 className="section-title">Your recent jobs</h3>
        {historyLoading && (
          <p className="page-subtitle">Loading your recent jobs…</p>
        )}
        {historyError && (
          <p className="alert alert-error">{historyError}</p>
        )}
        {!historyLoading && !historyError && historyJobs.length === 0 && (
          <div className="empty-state">
            You have not responded to any jobs yet.
          </div>
        )}
        {!historyLoading && !historyError && historyJobs.length > 0 && (
          <div className="job-list">
            {historyJobs.map((job) => (
              <Link key={job.id} to={`/jobs/${job.id}`} className="card-link">
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <strong className="card-title">{job.title}</strong>
                    <span className={`badge ${getStatusBadgeClass(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="card-meta">{job.locationText}</div>
                  <div className="card-meta">{formatJobDate(job.createdAt)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
