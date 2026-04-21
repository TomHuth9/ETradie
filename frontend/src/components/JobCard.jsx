import React from 'react';
import { Link } from 'react-router-dom';
import { formatJobDate } from '../utils/format';

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

export default function JobCard({
  job,
  onAccept,
  onDecline,
  accepting,
  declining,
  isNew = false,
}) {
  const cat = CAT_COLORS[job.category] || CAT_COLORS.OTHER_NOT_SURE;

  return (
    <div className={`job-card${isNew ? ' job-card-new' : ''}`} style={{ position: 'relative' }}>
      {isNew && (
        <span style={{
          position: 'absolute', top: 16, right: 16,
          background: 'var(--color-primary-light)', color: 'var(--color-primary)',
          borderRadius: 'var(--radius-full)', padding: '2px 9px',
          fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          New
        </span>
      )}

      <div className="job-card-header" style={{ paddingRight: isNew ? 56 : 0 }}>
        <div>
          <div className="job-card-title">{job.title}</div>
          <div className="job-card-meta">
            <span className="cat-pill" style={{ background: cat.bg, color: cat.color }}>
              {job.categoryLabel || job.category}
            </span>
            <span>📍 {job.locationText}</span>
            {job.createdAt && <span>{formatJobDate(job.createdAt)}</span>}
          </div>
        </div>
        {job.status && (
          <span className={`badge badge-${job.status.toLowerCase()}`} style={{ flexShrink: 0 }}>
            {job.status}
          </span>
        )}
      </div>

      {job.description && (
        <p className="job-card-desc">{job.description}</p>
      )}

      <div className="job-card-actions">
        <Link to={`/jobs/${job.id}`} className="btn btn-ghost btn-sm">View details</Link>
        {onAccept && (
          <button
            type="button"
            className="btn btn-accent btn-sm"
            onClick={onAccept}
            disabled={accepting || declining}
          >
            {accepting ? 'Accepting…' : 'Accept'}
          </button>
        )}
        {onDecline && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('Decline this job?')) onDecline();
            }}
            disabled={accepting || declining}
          >
            {declining ? 'Declining…' : 'Decline'}
          </button>
        )}
      </div>
    </div>
  );
}
