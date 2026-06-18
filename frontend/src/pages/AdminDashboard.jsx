import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const STATUS_COLORS = {
  PENDING:   { color: '#d97706', bg: '#fffbeb' },
  ACCEPTED:  { color: '#2563eb', bg: '#eff6ff' },
  COMPLETED: { color: '#059669', bg: '#ecfdf5' },
  CANCELLED: { color: '#dc2626', bg: '#fef2f2' },
  CLOSED:    { color: '#6b7280', bg: '#f3f4f6' },
};

const ROLE_COLORS = {
  HOMEOWNER:   { color: '#7c3aed', bg: '#f5f3ff' },
  TRADESPERSON: { color: '#2563eb', bg: '#eff6ff' },
  ADMIN:       { color: '#dc2626', bg: '#fef2f2' },
};

function StatusBadge({ value, map }) {
  const style = map[value] || { color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: '0.75rem',
      fontWeight: 600,
      letterSpacing: '0.02em',
      color: style.color,
      background: style.bg,
    }}>
      {value}
    </span>
  );
}

function Pagination({ page, total, limit, onPage }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
      <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</button>
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Page {page} of {totalPages}</span>
      <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next →</button>
    </div>
  );
}

function JobsTab() {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const LIMIT = 20;

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (status) params.set('status', status);
    api.get(`/admin/jobs?${params}`)
      .then(res => {
        if (cancelled) return;
        setJobs(res.data.jobs);
        setTotal(res.data.total);
      })
      .catch(err => { if (!cancelled) setError(err.response?.data?.message || 'Failed to load jobs.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, status]);

  useEffect(load, [load]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="form-select" value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          style={{ width: 'auto', minWidth: 150 }}>
          <option value="">All statuses</option>
          {['PENDING','ACCEPTED','COMPLETED','CANCELLED','CLOSED'].map(s => (
            <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase().replace(/_/g, ' ')}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{total} job{total !== 1 ? 's' : ''}</span>
      </div>

      {loading && <p className="page-subtitle">Loading…</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && jobs.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No jobs</div>
        </div>
      )}

      {jobs.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['ID', 'Title', 'Category', 'Status', 'Homeowner', 'Created'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontFamily: 'var(--font-heading)', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, i) => (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : 'var(--color-surface)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{job.id}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 500, maxWidth: 240 }}>
                    <span title={job.title} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{job.category.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '10px 12px' }}><StatusBadge value={job.status} map={STATUS_COLORS} /></td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontWeight: 500 }}>{job.homeowner?.name}</span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{job.homeowner?.email}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(job.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />
    </div>
  );
}

function UsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const LIMIT = 20;

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (role) params.set('role', role);
    api.get(`/admin/users?${params}`)
      .then(res => {
        if (cancelled) return;
        setUsers(res.data.users);
        setTotal(res.data.total);
      })
      .catch(err => { if (!cancelled) setError(err.response?.data?.message || 'Failed to load users.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, role]);

  useEffect(load, [load]);

  async function handleDelete(user) {
    if (!window.confirm(`Delete ${user.name} (${user.email})? This cannot be undone.`)) return;
    setDeleting(user.id);
    try {
      await api.delete(`/admin/users/${user.id}`);
      toast.success(`${user.name} deleted`);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setTotal(t => t - 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="form-select" value={role}
          onChange={e => { setRole(e.target.value); setPage(1); }}
          style={{ width: 'auto', minWidth: 160 }}>
          <option value="">All roles</option>
          {['HOMEOWNER','TRADESPERSON','ADMIN'].map(r => (
            <option key={r} value={r}>{r[0] + r.slice(1).toLowerCase()}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{total} user{total !== 1 ? 's' : ''}</span>
      </div>

      {loading && <p className="page-subtitle">Loading…</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && users.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <div className="empty-state-title">No users</div>
        </div>
      )}

      {users.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['ID', 'Name', 'Email', 'Role', 'Location', 'Joined', 'Online', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', padding: '8px 12px', fontFamily: 'var(--font-heading)', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : 'var(--color-surface)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{u.id}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{u.name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{u.email}</td>
                  <td style={{ padding: '10px 12px' }}><StatusBadge value={u.role} map={ROLE_COLORS} /></td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{u.townOrCity || u.address || '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: u.isOnline ? '#22c55e' : '#d1d5db' }} />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {u.id !== currentUser?.id && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-error, #dc2626)', borderColor: 'transparent' }}
                        disabled={deleting === u.id}
                        onClick={() => handleDelete(u)}
                      >
                        {deleting === u.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('jobs');

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Admin</h1>
        <p className="page-subtitle">Manage all jobs and users across ETradie.</p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--color-border)' }}>
        {[{ key: 'jobs', label: 'Jobs' }, { key: 'users', label: 'Users' }].map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -2,
              padding: '10px 20px',
              fontFamily: 'var(--font-heading)',
              fontWeight: tab === t.key ? 700 : 500,
              fontSize: '0.9375rem',
              color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'jobs' ? <JobsTab /> : <UsersTab />}
      </div>
    </div>
  );
}
