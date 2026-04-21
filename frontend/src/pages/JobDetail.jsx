import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { formatJobDate } from '../utils/format';
import { validateMessageContent, validateReviewComment } from '../utils/validation';

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
  const [homeownerRating, setHomeownerRating] = useState(null);
  const [messageError, setMessageError] = useState('');
  const [reviewCommentError, setReviewCommentError] = useState('');

  async function loadJob() {
    setError('');
    try {
      const res = await api.get(`/jobs/${id}`);
      setJob(res.data);
    } catch (err) {
      setError(err.response?.status === 404 ? 'Job not found.' : err.response?.data?.message || 'Could not load job.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.get(`/jobs/${id}`), api.get('/trades/categories').catch(() => ({ data: [] }))])
      .then(([jobRes, catRes]) => { if (!cancelled) { setJob(jobRes.data); setCategories(catRes.data); }})
      .catch(err => { if (!cancelled) setError(err.response?.status === 404 ? 'Job not found.' : err.response?.data?.message || 'Could not load job.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const acceptedTradesperson = job?.responses?.[0]?.tradesperson;
  const isHomeowner = user?.role === 'HOMEOWNER';
  const isTradesperson = user?.role === 'TRADESPERSON';
  const canMessage = Boolean(
    acceptedTradesperson &&
    (job?.status === 'ACCEPTED' || job?.status === 'COMPLETED') &&
    (isHomeowner && job?.homeownerId === user?.id || acceptedTradesperson?.id === user?.id)
  );
  const isCompleted = job?.status === 'COMPLETED';

  useEffect(() => {
    if (!id || !canMessage) return;
    let cancelled = false;
    setMessagesLoading(true);
    api.get(`/jobs/${id}/messages`)
      .then(res => { if (!cancelled && Array.isArray(res.data)) setMessages(res.data); })
      .catch(() => { if (!cancelled) setMessages([]); })
      .finally(() => { if (!cancelled) setMessagesLoading(false); });
    return () => { cancelled = true; };
  }, [id, canMessage]);

  useEffect(() => {
    if (!id || !isCompleted) return;
    let cancelled = false;
    setReviewsLoading(true);
    api.get(`/jobs/${id}/reviews`)
      .then(res => { if (!cancelled && Array.isArray(res.data)) setReviews(res.data); })
      .catch(() => { if (!cancelled) setReviews([]); })
      .finally(() => { if (!cancelled) setReviewsLoading(false); });
    return () => { cancelled = true; };
  }, [id, isCompleted]);

  useEffect(() => {
    if (!socket || !id || !canMessage) return;
    const handler = payload => {
      if (Number(payload.jobId) === Number(id) && payload.message)
        setMessages(prev => [...(Array.isArray(prev) ? prev : []), payload.message]);
    };
    socket.on('message:new', handler);
    return () => socket.off('message:new', handler);
  }, [socket, id, canMessage]);

  useEffect(() => {
    const homeownerId = job?.homeowner?.id;
    if (!homeownerId) return;
    let cancelled = false;
    api.get(`/users/${homeownerId}/rating`)
      .then(res => { if (!cancelled) setHomeownerRating(res.data); })
      .catch(() => { if (!cancelled) setHomeownerRating(null); });
    return () => { cancelled = true; };
  }, [job?.homeowner?.id]);

  async function handleRespond(response) {
    if (!job || !isTradesperson) return;
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
    setActionLoading(true); setError('');
    try { await api.post(`/jobs/${job.id}/cancel`); await loadJob(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to cancel job.'); }
    finally { setActionLoading(false); }
  }

  async function handleComplete() {
    setActionLoading(true); setError('');
    try { await api.post(`/jobs/${job.id}/complete`); await loadJob(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to mark complete.'); }
    finally { setActionLoading(false); }
  }

  async function handleClose() {
    if (!window.confirm('Close this job? It will no longer be visible to tradespeople.')) return;
    setActionLoading(true); setError('');
    try { await api.post(`/jobs/${job.id}/close`); await loadJob(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to close job.'); }
    finally { setActionLoading(false); }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    const msgErr = validateMessageContent(messageInput);
    setMessageError(msgErr || '');
    if (msgErr || sendingMessage) return;
    setSendingMessage(true);
    try {
      const res = await api.post(`/jobs/${id}/messages`, { content: messageInput.trim() });
      setMessages(prev => (Array.isArray(prev) ? prev : []).concat(res.data));
      setMessageInput(''); setMessageError('');
    } catch (err) { setError(err.response?.data?.message || 'Failed to send message.'); }
    finally { setSendingMessage(false); }
  }

  async function handleSubmitReview(e) {
    e.preventDefault();
    const commentErr = validateReviewComment(reviewComment);
    setReviewCommentError(commentErr || '');
    if (commentErr || submittingReview) return;
    setSubmittingReview(true);
    try {
      const res = await api.post(`/jobs/${id}/reviews`, { rating: reviewRating, comment: reviewComment.trim() || undefined });
      setReviews(prev => (Array.isArray(prev) ? prev : []).concat(res.data));
      setReviewComment(''); setReviewCommentError('');
      await loadJob();
    } catch (err) { setError(err.response?.data?.message || 'Failed to submit review.'); }
    finally { setSubmittingReview(false); }
  }

  if (loading) return <div className="page-header"><p className="page-subtitle">Loading job…</p></div>;
  if (error && !job) return (
    <div className="page-header">
      <div className="alert alert-error">{error}</div>
      <Link to={isHomeowner ? '/dashboard' : '/tradesperson-dashboard'} className="btn btn-secondary">Back to dashboard</Link>
    </div>
  );
  if (!job) return <div className="page-header"><p className="page-subtitle">Loading job…</p></div>;

  const canRespond  = isTradesperson && job.status === 'PENDING';
  const canCancel   = isHomeowner && (job.status === 'PENDING' || job.status === 'ACCEPTED');
  const canClose    = isHomeowner && job.status === 'PENDING';
  const canComplete = (isHomeowner || (isTradesperson && acceptedTradesperson?.id === user?.id)) && job.status === 'ACCEPTED';
  const categoryLabel = categories.find(c => c.id === job.category)?.label ?? job.category ?? '';
  const cat = CAT_COLORS[job.category] || CAT_COLORS.OTHER_NOT_SURE;
  const messagesList = Array.isArray(messages) ? messages : [];
  const reviewsList = Array.isArray(reviews) ? reviews : [];
  const myReview = reviewsList.find(r => r.reviewer?.id === user?.id);

  return (
    <div>
      <div style={{ paddingTop: '2rem', marginBottom: '1.5rem' }}>
        <Link to={isHomeowner ? '/dashboard' : '/tradesperson-dashboard'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', color: 'var(--color-text-muted)', textDecoration: 'none', fontWeight: 500 }}>
          ← Back to dashboard
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{job.title}</h2>
          <span className={`badge badge-${job.status.toLowerCase()}`}>{job.status}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <span className="cat-pill" style={{ background: cat.bg, color: cat.color, padding: '4px 12px' }}>{categoryLabel}</span>
          <span style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-full)', padding: '4px 12px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>📍 {job.locationText}</span>
          <span style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-full)', padding: '4px 12px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>🕐 {formatJobDate(job.createdAt)}</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</div>
          <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{job.description}</p>
        </div>

        {job.homeowner && (
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: acceptedTradesperson ? 12 : 0 }}>
            Posted by <strong>{job.homeowner.name}</strong>
            {isTradesperson && homeownerRating?.averageRating != null && (
              <> · ⭐ {homeownerRating.averageRating}{homeownerRating.reviewCount > 0 && ` (${homeownerRating.reviewCount})`}</>
            )}
          </div>
        )}

        {acceptedTradesperson && (
          <div style={{ background: 'var(--color-accent-light)', border: '1px solid #a7d7b8', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, marginTop: 'var(--space-md)' }}>
            <div className="accepted-strip-avatar">{acceptedTradesperson.name[0]}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                Accepted by{' '}
                <Link to={`/profile/${acceptedTradesperson.id}`} style={{ color: 'var(--color-accent)' }}>
                  {acceptedTradesperson.name}
                </Link>
              </div>
              {acceptedTradesperson.averageRating != null && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  ⭐ {acceptedTradesperson.averageRating}
                  {acceptedTradesperson.reviewCount > 0 && ` · ${acceptedTradesperson.reviewCount} review${acceptedTradesperson.reviewCount === 1 ? '' : 's'}`}
                </div>
              )}
            </div>
          </div>
        )}

        {canRespond && (
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-accent" onClick={() => handleRespond('ACCEPTED')} disabled={responding}>
              {responding ? 'Sending…' : 'Accept job'}
            </button>
            <button type="button" className="btn btn-danger" disabled={responding}
              onClick={() => { if (window.confirm('Decline this job?')) handleRespond('DECLINED'); }}>
              Decline
            </button>
          </div>
        )}

        {(canCancel || canComplete || canClose) && (
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            {canClose    && <button type="button" className="btn btn-ghost"  onClick={handleClose}    disabled={actionLoading}>{actionLoading ? 'Closing…'     : 'Close job'}</button>}
            {canCancel   && <button type="button" className="btn btn-danger" onClick={handleCancel}   disabled={actionLoading}>{actionLoading ? 'Cancelling…'  : 'Cancel job'}</button>}
            {canComplete && <button type="button" className="btn btn-accent" onClick={handleComplete} disabled={actionLoading}>{actionLoading ? 'Updating…'    : 'Mark complete'}</button>}
          </div>
        )}
      </div>

      {canMessage && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.0625rem' }}>Messages</h3>
          {messagesLoading ? <p className="page-subtitle">Loading messages…</p> : (
            <>
              <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 14 }}>
                {messagesList.length === 0
                  ? <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No messages yet. Start the conversation.</p>
                  : messagesList.map(msg => {
                      const isMe = msg.sender?.id === user?.id;
                      return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                          <div className={`message-bubble ${isMe ? 'message-bubble-me' : 'message-bubble-other'}`}>
                            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 3 }}>
                              {msg.sender?.name} · {formatJobDate(msg.createdAt)}
                            </div>
                            <div style={{ fontSize: '0.875rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                          </div>
                        </div>
                      );
                    })
                }
              </div>
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 10 }}>
                <textarea
                  className={`form-textarea${messageError ? ' form-input-error' : ''}`}
                  rows={2}
                  placeholder="Type a message…"
                  value={messageInput}
                  onChange={e => { setMessageInput(e.target.value); setMessageError(''); }}
                  disabled={sendingMessage}
                  style={{ flex: 1, minHeight: 'unset', resize: 'none' }}
                />
                <button type="submit" className="btn btn-primary" disabled={sendingMessage || !messageInput.trim()} style={{ alignSelf: 'flex-end' }}>
                  {sendingMessage ? '…' : 'Send'}
                </button>
              </form>
              {messageError && <span className="form-field-error">{messageError}</span>}
            </>
          )}
        </div>
      )}

      {isCompleted && (
        <div className="card">
          <h3 style={{ margin: '0 0 16px', fontSize: '1.0625rem' }}>Reviews</h3>
          {reviewsLoading ? <p className="page-subtitle">Loading reviews…</p> : (
            <>
              {reviewsList.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  {reviewsList.map(r => (
                    <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                        <strong>{r.reviewer?.name}</strong>
                        <span style={{ color: 'var(--color-text-muted)' }}> → {r.reviewee?.name}</span>
                        <span style={{ marginLeft: 8, background: '#fef9e7', color: 'var(--color-star)', borderRadius: 'var(--radius-full)', padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }}>
                          ⭐ {r.rating}
                        </span>
                      </div>
                      {r.comment && <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}

              {!myReview && (
                <form onSubmit={handleSubmitReview}>
                  <h4 style={{ margin: '0 0 14px', fontSize: '0.9375rem', fontFamily: 'var(--font-heading)' }}>Leave a review</h4>
                  <div className="form-group">
                    <label className="form-label">Rating</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[1,2,3,4,5].map(n => (
                        <button key={n} type="button"
                          onClick={() => setReviewRating(n)}
                          style={{ background: n <= reviewRating ? '#fef3c7' : 'var(--color-surface)', border: `1.5px solid ${n <= reviewRating ? '#fde68a' : 'var(--color-border)'}`, borderRadius: 8, width: 40, height: 40, cursor: 'pointer', fontSize: '1rem', transition: 'all 0.12s' }}>
                          ⭐
                        </button>
                      ))}
                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', alignSelf: 'center', marginLeft: 4 }}>{reviewRating} / 5</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reviewComment">Comment (optional)</label>
                    <textarea id="reviewComment" rows={2}
                      className={`form-textarea${reviewCommentError ? ' form-input-error' : ''}`}
                      value={reviewComment}
                      onChange={e => { setReviewComment(e.target.value); setReviewCommentError(''); }}
                      placeholder="How did it go?"
                      disabled={submittingReview}
                    />
                    {reviewCommentError && <span className="form-field-error">{reviewCommentError}</span>}
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
