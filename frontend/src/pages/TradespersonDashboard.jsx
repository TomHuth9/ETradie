import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import JobCard from '../components/JobCard';
import { formatJobDate } from '../utils/format';

export default function TradespersonDashboard() {
  const { user, socket, isSocketConnected } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [busyJobId, setBusyJobId] = useState(null);
  const [error, setError] = useState('');
  const [historyJobs, setHistoryJobs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(true);

  const connectionLabel = !socket
    ? 'Connecting…'
    : isSocketConnected
    ? 'Live - receiving job requests'
    : 'Reconnecting…';

  const categoryMap = useMemo(
    () => categories.reduce((acc, cat) => { acc[cat.id] = cat.label; return acc; }, {}),
    [categories]
  );

  const filteredJobs = useMemo(
    () => categoryFilter ? jobs.filter(j => j.category === categoryFilter) : jobs,
    [jobs, categoryFilter]
  );

  useEffect(() => {
    api.get('/trades/categories').then(res => setCategories(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    api.get('/jobs/my')
      .then(res => { if (!cancelled) { const d = res.data; setHistoryJobs(Array.isArray(d.jobs) ? d.jobs : (Array.isArray(d) ? d : [])); }})
      .catch(err => { if (!cancelled) console.error(err); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setNearbyLoading(true);
    api.get('/jobs/nearby')
      .then(res => {
        if (cancelled) return;
        setJobs(prev => {
          const byId = new Map(prev.map(j => [j.id, j]));
          res.data.forEach(j => byId.set(j.id, j));
          return [...byId.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setNearbyLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!socket) return;
    function handleNewJob(job) {
      setJobs(prev => prev.some(j => j.id === job.id) ? prev : [job, ...prev]);
    }
    socket.on('job:new', handleNewJob);
    return () => socket.off('job:new', handleNewJob);
  }, [socket]);

  async function respond(jobId, response) {
    setBusyJobId(jobId);
    setError('');
    try {
      await api.post(`/jobs/${jobId}/respond`, { response });
      setJobs(prev => prev.filter(j => j.id !== jobId));
      const res = await api.get('/jobs/my');
      const d = res.data;
      setHistoryJobs(Array.isArray(d.jobs) ? d.jobs : (Array.isArray(d) ? d : []));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send response.');
    } finally {
      setBusyJobId(null);
    }
  }

  return (
    <div>
      <div className="dashboard-welcome">
        <div>
          <h2>Good to see you{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋</h2>
          <p className="page-subtitle">New jobs near you will appear here in real time.</p>
        </div>
        <div className={`connection-status${isSocketConnected ? ' connected' : ' disconnected'}`}>
          <span className="connection-status-dot" />
          {connectionLabel}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: '2rem' }}>
        {[
          { icon: '📬', value: filteredJobs.length, label: 'New requests' },
          { icon: '✅', value: historyJobs.filter(j => j.status === 'COMPLETED').length, label: 'Completed' },
          { icon: '⭐', value: user?.averageRating ?? '-', label: 'Your rating' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{s.icon}</div>
            <div className="stat-n">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="section">
        <div className="section-header">
          <h3 className="section-title">New job requests</h3>
          {categories.length > 0 && (
            <select className="form-select" value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ width: 'auto', minWidth: 180 }}>
              <option value="">All categories</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
            </select>
          )}
        </div>

        {nearbyLoading && jobs.length === 0 && <p className="page-subtitle">Loading nearby jobs…</p>}

        {!nearbyLoading && filteredJobs.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-title">Waiting for nearby jobs…</div>
            <div className="empty-state-body">
              {jobs.length === 0
                ? 'Keep this page open to receive real-time requests.'
                : 'No jobs in this category. Try "All categories".'}
            </div>
          </div>
        )}

        {filteredJobs.length > 0 && (
          <div className="job-list">
            {filteredJobs.map(job => (
              <JobCard
                key={job.id}
                job={{ ...job, categoryLabel: categoryMap[job.category] }}
                accepting={busyJobId === job.id}
                declining={busyJobId === job.id}
                onAccept={() => respond(job.id, 'ACCEPTED')}
                onDecline={() => respond(job.id, 'DECLINED')}
                isNew
              />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h3 className="section-title" style={{ marginBottom: '1rem' }}>Your recent jobs</h3>

        {historyLoading && <p className="page-subtitle">Loading your recent jobs…</p>}

        {!historyLoading && historyJobs.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📂</div>
            <div className="empty-state-title">No jobs yet</div>
            <div className="empty-state-body">Jobs you accept will appear here.</div>
          </div>
        )}

        {historyJobs.length > 0 && (
          <div className="job-list">
            {historyJobs.map(job => (
              <Link key={job.id} to={`/jobs/${job.id}`} className="card-link">
                <div className="job-card">
                  <div className="job-card-header">
                    <div>
                      <div className="job-card-title">{job.title}</div>
                      <div className="job-card-meta">
                        <span>📍 {job.locationText}</span>
                        <span>{formatJobDate(job.createdAt)}</span>
                      </div>
                    </div>
                    <span className={`badge badge-${job.status.toLowerCase()}`}>{job.status}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
