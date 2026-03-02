import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { formatJobDate } from '../utils/format';

export default function TradespersonProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categoriesList, setCategoriesList] = useState([]);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const [profileRes, catRes] = await Promise.all([
          api.get(`/users/${id}/profile`),
          api.get('/trades/categories').catch(() => ({ data: [] })),
        ]);
        setProfile(profileRes.data);
        setCategoriesList(catRes.data || []);
      } catch (err) {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!id || !profile) return;
    let cancelled = false;
    setReviewsLoading(true);
    api.get(`/users/${id}/reviews`)
      .then((res) => { if (!cancelled && Array.isArray(res.data)) setReviews(res.data); })
      .catch(() => { if (!cancelled) setReviews([]); })
      .finally(() => { if (!cancelled) setReviewsLoading(false); });
    return () => { cancelled = true; };
  }, [id, profile]);

  if (!id) return null;

  if (user?.id === Number(id)) {
    navigate('/profile', { replace: true });
    return <div className="page-header"><p>Redirecting to your profile…</p></div>;
  }

  if (loading) return <div className="page-header"><p>Loading…</p></div>;
  if (!profile) return <div className="page-header"><p>Profile not found.</p></div>;

  const categoryMap = categoriesList.reduce((acc, c) => ({ ...acc, [c.id]: c.label }), {});
  const isTradesperson = profile.role === 'TRADESPERSON';

  return (
    <div>
      <div className="page-header">
        <h2>{profile.name}</h2>
        <p className="page-subtitle">
          {isTradesperson && profile.townOrCity && <>Based in {profile.townOrCity}</>}
          {!isTradesperson && <>Homeowner</>}
          {profile.averageRating != null && (
            <> · ★ {profile.averageRating} {profile.reviewCount != null ? `(${profile.reviewCount} review${profile.reviewCount === 1 ? '' : 's'})` : ''}</>
          )}
        </p>
        {isTradesperson && profile.availability !== false && (
          <span className="badge badge-success">Available for jobs</span>
        )}
      </div>

      {isTradesperson && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Trade categories</h3>
          {profile.categories?.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {(profile.categories || []).map((catId) => (
                <span key={catId} className="badge badge-default">
                  {categoryMap[catId] || catId}
                </span>
              ))}
            </div>
          ) : (
            <p className="card-meta">No categories set.</p>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Reviews</h3>
        {reviewsLoading ? (
          <p className="card-meta">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <p className="card-meta">No reviews yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reviews.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: '0.75rem 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600 }}>{r.reviewer?.name}</span>
                  <span>·</span>
                  <span>★ {r.rating}</span>
                  {r.job?.title && (
                    <>
                      <span>·</span>
                      <Link to={`/jobs/${r.job.id}`} className="card-meta-link">{r.job.title}</Link>
                    </>
                  )}
                  <span className="card-meta" style={{ marginLeft: 'auto' }}>{formatJobDate(r.createdAt)}</span>
                </div>
                {r.comment && <p style={{ margin: 0, fontSize: '0.9375rem', whiteSpace: 'pre-wrap' }}>{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
