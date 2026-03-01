import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export default function TradespersonProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categoriesList, setCategoriesList] = useState([]);

  useEffect(() => {
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

  if (loading) return <div className="page-header"><p>Loading…</p></div>;
  if (!profile) return <div className="page-header"><p>Profile not found.</p></div>;
  if (profile.role !== 'TRADESPERSON') return <div className="page-header"><p>This user is not a tradesperson.</p></div>;

  const categoryMap = categoriesList.reduce((acc, c) => ({ ...acc, [c.id]: c.label }), {});

  return (
    <div>
      <div className="page-header">
        <h2>{profile.name}</h2>
        <p className="page-subtitle">
          {profile.townOrCity && <>Based in {profile.townOrCity}</>}
          {profile.averageRating != null && (
            <> · ★ {profile.averageRating} {profile.reviewCount != null ? `(${profile.reviewCount} reviews)` : ''}</>
          )}
        </p>
        {profile.availability !== false && (
          <span className="badge badge-success">Available for jobs</span>
        )}
      </div>
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
      {user?.id === Number(id) && (
        <p style={{ marginTop: '1rem' }}>
          <Link to="/profile" className="btn btn-secondary">Edit your profile</Link>
        </p>
      )}
    </div>
  );
}
