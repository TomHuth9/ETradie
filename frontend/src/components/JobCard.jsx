import React from 'react';
import { Link } from 'react-router-dom';
import { formatJobDate } from '../utils/format';

export default function JobCard({
  job,
  onAccept,
  onDecline,
  accepting,
  declining,
  isNew = true,
}) {
  return (
    <div className={`job-card ${isNew ? 'job-card-new' : ''}`}>
      <h3 className="card-title" style={{ marginTop: 0 }}>{job.title}</h3>
      <div className="card-meta">
        <strong>Category:</strong> {job.categoryLabel || job.category}
        {job.createdAt && (
          <> · {formatJobDate(job.createdAt)}</>
        )}
      </div>
      <div className="card-meta">
        <strong>Location:</strong> {job.locationText}
      </div>
      <p style={{ margin: '0.5rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
        {job.description}
      </p>
      <div className="job-card-actions">
        <Link to={`/jobs/${job.id}`} className="btn btn-secondary">
          View details
        </Link>
        <button
          type="button"
          className="btn btn-accent"
          onClick={onAccept}
          disabled={accepting || declining}
        >
          {accepting ? 'Accepting...' : 'Accept'}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm('Are you sure you want to decline this job?')) {
              onDecline();
            }
          }}
          disabled={accepting || declining}
        >
          {declining ? 'Declining...' : 'Decline'}
        </button>
      </div>
    </div>
  );
}
