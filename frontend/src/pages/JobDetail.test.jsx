import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../api/client', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

let mockAuth = { user: { id: 1, role: 'HOMEOWNER' }, socket: null };
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

import JobDetail from './JobDetail';

const categories = [{ id: 'PLUMBING', label: 'Plumbing' }];

const pendingJob = {
  id: 5, title: 'Fix leaking tap', description: 'Kitchen tap drips.', category: 'PLUMBING',
  locationText: '10 High Street, Glasgow', status: 'PENDING', createdAt: '2026-01-01T00:00:00Z',
  homeownerId: 1, homeowner: { id: 1, name: 'Grace Homeowner' }, myResponse: null,
};

const acceptedJob = {
  ...pendingJob, status: 'ACCEPTED',
  responses: [{ tradesperson: { id: 2, name: 'Tom Tradesperson', averageRating: 4.5, reviewCount: 2 } }],
};

const completedJob = { ...acceptedJob, status: 'COMPLETED' };

function mockApi({ job, messages = [], reviews = [], quotes = [] }) {
  mockGet.mockImplementation((url) => {
    if (url === `/jobs/${job.id}`) return Promise.resolve({ data: job });
    if (url === '/trades/categories') return Promise.resolve({ data: categories });
    if (url === `/jobs/${job.id}/messages`) return Promise.resolve({ data: messages });
    if (url === `/jobs/${job.id}/reviews`) return Promise.resolve({ data: reviews });
    if (url === `/jobs/${job.id}/quotes`) return Promise.resolve({ data: quotes });
    if (url.match(/\/users\/\d+\/rating/)) return Promise.resolve({ data: { averageRating: null, reviewCount: 0 } });
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

function renderJobDetail(id = '5') {
  return render(
    <MemoryRouter initialEntries={[`/jobs/${id}`]}>
      <Routes>
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/dashboard" element={<div>Homeowner dashboard page</div>} />
        <Route path="/tradesperson-dashboard" element={<div>Tradesperson dashboard page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('JobDetail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = { user: { id: 1, role: 'HOMEOWNER' }, socket: null };
  });

  test('shows "Job not found." for a 404', async () => {
    mockGet.mockRejectedValue({ response: { status: 404 } });
    renderJobDetail('999');

    await waitFor(() => {
      expect(screen.getByText(/job not found/i)).toBeInTheDocument();
    });
  });

  test('renders job details once loaded', async () => {
    mockApi({ job: pendingJob });
    renderJobDetail();

    await waitFor(() => expect(screen.getByText('Fix leaking tap')).toBeInTheDocument());
    expect(screen.getByText('Kitchen tap drips.')).toBeInTheDocument();
    expect(screen.getByText(/10 High Street, Glasgow/)).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  test('a tradesperson can submit a quote on a pending job', async () => {
    mockAuth = { user: { id: 2, role: 'TRADESPERSON' }, socket: null };
    mockApi({ job: pendingJob });
    mockPost.mockResolvedValue({ data: {} });
    renderJobDetail();

    await waitFor(() => expect(screen.getByText('Fix leaking tap')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/your price/i), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /submit quote/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/jobs/5/quote', { price: 150, message: undefined }));
  });

  test('rejects an empty price when submitting a quote', async () => {
    mockAuth = { user: { id: 2, role: 'TRADESPERSON' }, socket: null };
    mockApi({ job: pendingJob });
    renderJobDetail();

    await waitFor(() => expect(screen.getByText('Fix leaking tap')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /submit quote/i }));

    expect(await screen.findByText(/enter a price/i)).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  test('a tradesperson can decline a pending job, which navigates to their dashboard', async () => {
    mockAuth = { user: { id: 2, role: 'TRADESPERSON' }, socket: null };
    mockApi({ job: pendingJob });
    mockPost.mockResolvedValue({ data: {} });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderJobDetail();

    await waitFor(() => expect(screen.getByText('Fix leaking tap')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^decline$/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/jobs/5/decline'));
    await waitFor(() => {
      expect(screen.getByText(/tradesperson dashboard page/i)).toBeInTheDocument();
    });
    confirmSpy.mockRestore();
  });

  test('pre-fills the quote form when the tradesperson already quoted', async () => {
    mockAuth = { user: { id: 2, role: 'TRADESPERSON' }, socket: null };
    mockApi({ job: { ...pendingJob, myResponse: { response: 'QUOTED', price: 200, message: 'Can start Monday' } } });
    renderJobDetail();

    await waitFor(() => expect(screen.getByText(/update your quote/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/your price/i)).toHaveValue(200);
    expect(screen.getByLabelText(/message/i)).toHaveValue('Can start Monday');
  });

  test('a homeowner sees a list of quotes and can accept one', async () => {
    mockApi({
      job: pendingJob,
      quotes: [{ id: 99, response: 'QUOTED', price: 150, message: 'Available Tuesday', tradesperson: { id: 2, name: 'Tom Tradesperson', averageRating: 4.5, reviewCount: 2 } }],
    });
    mockPost.mockResolvedValue({ data: {} });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderJobDetail();

    await waitFor(() => expect(screen.getByText('Tom Tradesperson')).toBeInTheDocument());
    expect(screen.getByText('£150.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^accept$/i }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/jobs/5/quotes/99/accept'));
    confirmSpy.mockRestore();
  });

  test('a homeowner sees cancel and close actions on a pending job', async () => {
    mockApi({ job: pendingJob });
    renderJobDetail();

    await waitFor(() => expect(screen.getByText('Fix leaking tap')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /cancel job/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close job/i })).toBeInTheDocument();
  });

  test('shows the accepted tradesperson and allows messaging once a job is accepted', async () => {
    mockApi({ job: acceptedJob, messages: [
      { id: 1, content: 'Hi there', sender: { id: 2, name: 'Tom Tradesperson' }, createdAt: '2026-01-01T00:00:00Z' },
    ] });
    renderJobDetail();

    await waitFor(() => expect(screen.getByText(/accepted by/i)).toBeInTheDocument());
    expect(screen.getByText('Tom Tradesperson')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });
  });

  test('sending a message posts to the API and appends it to the conversation', async () => {
    mockApi({ job: acceptedJob, messages: [] });
    mockPost.mockResolvedValue({ data: { id: 2, content: 'On my way', sender: { id: 1, name: 'Grace Homeowner' }, createdAt: '2026-01-01T00:00:00Z' } });
    renderJobDetail();

    await waitFor(() => expect(screen.getByText(/no messages yet/i)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/type a message/i), { target: { value: 'On my way' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/jobs/5/messages', { content: 'On my way' }));
    await waitFor(() => {
      expect(screen.getByText('On my way')).toBeInTheDocument();
    });
  });

  test('a homeowner can leave a review on a completed job', async () => {
    mockApi({ job: completedJob, reviews: [] });
    mockPost.mockResolvedValue({ data: { id: 1, rating: 5, reviewer: { id: 1, name: 'Grace Homeowner' } } });
    renderJobDetail();

    await waitFor(() => expect(screen.getByText(/leave a review/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /submit review/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/jobs/5/reviews', { rating: 5, comment: undefined }));
  });

  test('does not show the review form if the current user already reviewed', async () => {
    mockApi({
      job: completedJob,
      reviews: [{ id: 1, rating: 5, reviewer: { id: 1, name: 'Grace Homeowner' }, reviewee: { id: 2, name: 'Tom Tradesperson' } }],
    });
    renderJobDetail();

    // The accepted-tradesperson strip also renders "· 2 reviews" as plain
    // text, so target the section heading specifically rather than any text
    // containing "review".
    await waitFor(() => expect(screen.getByRole('heading', { name: /^reviews$/i })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /submit review/i })).not.toBeInTheDocument();
  });
});
