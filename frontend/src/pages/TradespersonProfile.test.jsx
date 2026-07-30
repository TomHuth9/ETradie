import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../api/client', () => ({
  default: { get: (...args) => mockGet(...args) },
}));

let mockUser = { id: 1, role: 'HOMEOWNER' };
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

import TradespersonProfile from './TradespersonProfile';

const categories = [{ id: 'PLUMBING', label: 'Plumbing' }, { id: 'ELECTRICAL', label: 'Electrical' }];

function mockApi({ profile, reviews = [], categoriesRes = categories }) {
  mockGet.mockImplementation((url) => {
    if (url.endsWith('/profile')) return Promise.resolve({ data: profile });
    if (url === '/trades/categories') return Promise.resolve({ data: categoriesRes });
    if (url.endsWith('/reviews')) return Promise.resolve({ data: reviews });
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

function renderProfile(id = '2') {
  return render(
    <MemoryRouter initialEntries={[`/profile/${id}`]}>
      <Routes>
        <Route path="/profile/:id" element={<TradespersonProfile />} />
        <Route path="/profile" element={<div>Own profile page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TradespersonProfile page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1, role: 'HOMEOWNER' };
  });

  test('shows a tradesperson profile with town, rating, and availability', async () => {
    mockApi({
      profile: {
        id: 2, name: 'Tom Tradesperson', role: 'TRADESPERSON', townOrCity: 'Glasgow',
        availability: true, isOnline: false, categories: ['PLUMBING'],
        averageRating: 4.5, reviewCount: 3,
      },
    });
    renderProfile('2');

    await waitFor(() => expect(screen.getByText('Tom Tradesperson')).toBeInTheDocument());
    expect(screen.getByText(/based in glasgow/i)).toBeInTheDocument();
    expect(screen.getByText(/4\.5/)).toBeInTheDocument();
    expect(screen.getByText(/3 reviews/i)).toBeInTheDocument();
    expect(screen.getByText(/available for jobs/i)).toBeInTheDocument();
    expect(screen.getByText('Plumbing')).toBeInTheDocument();
  });

  test('shows "Homeowner" and no trade-specific sections for a homeowner profile', async () => {
    mockApi({ profile: { id: 3, name: 'Grace Homeowner', role: 'HOMEOWNER' } });
    renderProfile('3');

    await waitFor(() => expect(screen.getByText('Grace Homeowner')).toBeInTheDocument());
    expect(screen.getByText('Homeowner')).toBeInTheDocument();
    expect(screen.queryByText(/trade categories/i)).not.toBeInTheDocument();
  });

  test('redirects to your own profile page instead of showing this view', async () => {
    mockUser = { id: 2, role: 'TRADESPERSON' };
    mockApi({ profile: { id: 2, name: 'Tom Tradesperson', role: 'TRADESPERSON' } });
    renderProfile('2');

    await waitFor(() => {
      expect(screen.getByText(/own profile page/i)).toBeInTheDocument();
    });
  });

  test('shows "No reviews yet." when there are none', async () => {
    mockApi({ profile: { id: 2, name: 'Tom Tradesperson', role: 'TRADESPERSON' }, reviews: [] });
    renderProfile('2');

    await waitFor(() => {
      expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
    });
  });

  test('renders a list of reviews when present', async () => {
    mockApi({
      profile: { id: 2, name: 'Tom Tradesperson', role: 'TRADESPERSON' },
      reviews: [
        { id: 1, rating: 5, comment: 'Great work', reviewer: { name: 'Grace Homeowner' }, createdAt: '2026-01-01T00:00:00Z' },
      ],
    });
    renderProfile('2');

    await waitFor(() => {
      expect(screen.getByText('Great work')).toBeInTheDocument();
    });
    expect(screen.getByText('Grace Homeowner')).toBeInTheDocument();
  });

  test('shows "Profile not found." when the profile fails to load', async () => {
    mockGet.mockRejectedValue(new Error('404'));
    renderProfile('999');

    await waitFor(() => {
      expect(screen.getByText(/profile not found/i)).toBeInTheDocument();
    });
  });
});
