import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { formatJobDate, getStatusBadgeClass } from '../utils/format';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, socket } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [responding, setResponding] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  async function loadJob() {
    setError('');
    try {
      const jobRes = await api.get(`/jobs/${id}`);
      setJob(jobRes.data);
    } catch (err) {
      setError(err.response?.status === 404 ? 'Job not found.' : err.response?.data?.message || 'Could not load job.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [jobRes, catRes] = await Promise.all([
          api.get(`/jobs/${id}`),
          api.get('/trades/categories').catch(() => ({ data: [] })),
        ]);
        if (!cancelled) {
          setJob(jobRes.data);
          setCategories(catRes.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.status === 404 ? 'Job not found.' : err.response?.data?.message || 'Could not load job.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  const acceptedTradespersonForEffects = job?.responses?.[0]?.tradesperson;
  const canMessageForEffects = Boolean(
    acceptedTradespersonForEffects &&
    (job?.status === 'ACCEPTED' || job?.status === 'COMPLETED') &&
    (user?.role === 'HOMEOWNER' && job?.homeownerId === user?.id || acceptedTradespersonForEffects?.id === user?.id)
  );
  const isCompletedForEffects = job?.status === 'COMPLETED';

  useEffect(() => {
    if (!id || !canMessageForEffects) return;
    let cancelled = false;
    setMessagesLoading(true);
    api.get(`/jobs/${id}/messages`)
      .then((res) => { if (!cancelled && Array.isArray(res.data)) setMessages(res.data); })
      .catch(() => { if (!cancelled) setMessages([]); })
      .finally(() => { if (!cancelled) setMessagesLoading(false); });
    return () => { cancelled = true; };
  }, [id, canMessageForEffects]);

  useEffect(() => {
    if (!id || !isCompletedForEffects) return;
    let cancelled = false;
    setReviewsLoading(true);
    api.get(`/jobs/${id}/reviews`)
      .then((res) => { if (!cancelled && Array.isArray(res.data)) setReviews(res.data); })
      .catch(() => { if (!cancelled) setReviews([]); })
      .finally(() => { if (!cancelled) setReviewsLoading(false); });
    return () => { cancelled = true; };
  }, [id, isCompletedForEffects]);

  useEffect(() => {
    if (!socket || !id || !canMessageForEffects) return;
    const handler = (payload) => {
      if (Number(payload.jobId) === Number(id) && payload.message) {
        setMessages((prev) => [...(Array.isArray(prev) ? prev : []), payload.message]);
      }
    };
    socket.on('message:new', handler);
    return () => { socket.off('message:new', handler); };
  }, [socket, id, canMessageForEffects]);

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

  async function handleCancel() {
    if (!job) return;
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/jobs/${job.id}/cancel`);
      await loadJob();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel job.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleComplete() {
    if (!job) return;
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/jobs/${job.id}/complete`);
      await loadJob();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark job complete.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClose() {
    if (!job) return;
    if (!window.confirm('Close this job? It will no longer be visible to tradespeople.')) return;
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/jobs/${job.id}/close`);
      await loadJob();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to close job.');
    } finally {
      setActionLoading(false);
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

  if (!job) {
    return (
      <div className="page-header">
        <p className="page-subtitle">Loading job…</p>
      </div>
    );
  }

  const isHomeowner = user?.role === 'HOMEOWNER';
  const isTradesperson = user?.role === 'TRADESPERSON';
  const canRespond = isTradesperson && job?.status === 'PENDING';
  const acceptedTradesperson = job?.responses?.[0]?.tradesperson;
  const canCancel = isHomeowner && (job?.status === 'PENDING' || job?.status === 'ACCEPTED');
  const canClose = isHomeowner && job?.status === 'PENDING';
  const canComplete = (isHomeowner || (isTradesperson && acceptedTradesperson?.id === user?.id)) && job?.status === 'ACCEPTED';
  const canMessage = acceptedTradesperson && (job?.status === 'ACCEPTED' || job?.status === 'COMPLETED') && (isHomeowner || acceptedTradesperson?.id === user?.id);
  const isCompleted = job?.status === 'COMPLETED';
  const messagesList = Array.isArray(messages) ? messages : [];
  const reviewsList = Array.isArray(reviews) ? reviews : [];
  const myReview = reviewsList.find((r) => r.reviewer?.id === user?.id);

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageInput.trim() || sendingMessage) return;
    setSendingMessage(true);
    setError('');
    try {
      const res = await api.post(`/jobs/${id}/messages`, { content: messageInput.trim() });
      setMessages((prev) => (Array.isArray(prev) ? prev : []).concat(res.data));
      setMessageInput('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send message.');
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleSubmitReview(e) {
    e.preventDefault();
    if (submittingReview) return;
    setSubmittingReview(true);
    setError('');
    try {
      const res = await api.post(`/jobs/${id}/reviews`, { rating: reviewRating, comment: reviewComment.trim() || undefined });
      setReviews((prev) => (Array.isArray(prev) ? prev : []).concat(res.data));
      setReviewComment('');
      await loadJob();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  }

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

        {acceptedTradesperson && (
          <div className="card-meta" style={{ marginTop: '0.5rem' }}>
            Accepted by{' '}
            <Link to={`/profile/${acceptedTradesperson.id}`} className="card-meta-link">
              <strong>{acceptedTradesperson.name}</strong>
              {acceptedTradesperson.averageRating != null && (
                <> · ★ {acceptedTradesperson.averageRating}{acceptedTradesperson.reviewCount > 0 ? ` (${acceptedTradesperson.reviewCount} review${acceptedTradesperson.reviewCount === 1 ? '' : 's'})` : ''}</>
              )}
            </Link>
          </div>
        )}

        {canRespond && (
          <div className="job-card-actions" style={{ marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => handleRespond('ACCEPTED')}
              disabled={responding}
            >
              {responding ? 'Sending…' : 'Accept job'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm('Are you sure you want to decline this job?')) {
                  handleRespond('DECLINED');
                }
              }}
              disabled={responding}
            >
              Decline
            </button>
          </div>
        )}

        {(canCancel || canComplete || canClose) && (
          <div className="job-card-actions" style={{ marginTop: '1rem' }}>
            {canClose && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
                disabled={actionLoading}
              >
                {actionLoading ? 'Closing…' : 'Close job (no longer needed)'}
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleCancel}
                disabled={actionLoading}
              >
                {actionLoading ? 'Cancelling…' : 'Cancel job'}
              </button>
            )}
            {canComplete && (
              <button
                type="button"
                className="btn btn-accent"
                onClick={handleComplete}
                disabled={actionLoading}
              >
                {actionLoading ? 'Updating…' : 'Mark complete'}
              </button>
            )}
          </div>
        )}
      </div>

      {canMessage && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Messages</h3>
          {messagesLoading ? (
            <p className="page-subtitle">Loading messages…</p>
          ) : (
            <>
              <div style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '1rem' }}>
                {messagesList.length === 0 ? (
                  <p className="card-meta">No messages yet. Start the conversation.</p>
                ) : (
                  messagesList.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        padding: '0.5rem 0',
                        borderBottom: '1px solid var(--color-border)',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        {msg.sender?.name}
                      </span>
                      <span className="card-meta" style={{ marginLeft: '0.5rem' }}>
                        {formatJobDate(msg.createdAt)}
                      </span>
                      <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleSendMessage}>
                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Type a message…"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    disabled={sendingMessage}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={sendingMessage || !messageInput.trim()}>
                  {sendingMessage ? 'Sending…' : 'Send'}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {isCompleted && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Reviews</h3>
          {reviewsLoading ? (
            <p className="page-subtitle">Loading reviews…</p>
          ) : (
            <>
              {reviewsList.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  {reviewsList.map((r) => (
                    <div key={r.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ fontWeight: 600 }}>{r.reviewer?.name}</span>
                      {' → '}
                      <span>{r.reviewee?.name}</span>
                      <span> · ★ {r.rating}</span>
                      {r.comment && <p style={{ margin: '0.25rem 0 0', fontSize: '0.9375rem' }}>{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
              {!myReview && (
                <form onSubmit={handleSubmitReview}>
                  <div className="form-group">
                    <label className="form-label">Your rating (1–5)</label>
                    <select
                      className="form-select"
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      style={{ width: 'auto' }}
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n} ★</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Comment (optional)</label>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="How did it go?"
                      disabled={submittingReview}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={submittingReview}>
                    {submittingReview ? 'Submitting…' : 'Submit review'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
