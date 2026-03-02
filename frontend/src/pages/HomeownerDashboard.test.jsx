import React from 'react';
import { MemoryRouter } from 'react-router-dom';
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

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      role: 'HOMEOWNER',
      address: '10 High Street, Glasgow',
    },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import HomeownerDashboard from './HomeownerDashboard';

const categories = [
  { id: 'PLUMBING', label: 'Plumbing' },
  { id: 'HEATING_BOILERS', label: 'Heating & Boilers' },
  { id: 'OTHER_NOT_SURE', label: 'Other / Not Sure' },
];

describe('HomeownerDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url) => {
      if (url === '/trades/categories') {
        return Promise.resolve({ data: categories });
      }
      if (url.startsWith('/jobs/my')) {
        return Promise.resolve({ data: { jobs: [], total: 0 } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    mockPost.mockResolvedValue({ data: { id: 1, title: 'Test job' } });
  });

  test('renders dashboard and post job form', async () => {
    render(
      <MemoryRouter>
        <HomeownerDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /homeowner dashboard/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /post a job/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/job location/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /post job|submit/i })).toBeInTheDocument();
  });

  test('submitting valid job form calls api.post with job payload', async () => {
    render(
      <MemoryRouter>
        <HomeownerDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText(/title/i);
    const descriptionInput = screen.getByLabelText(/description/i);
    const locationInput = screen.getByLabelText(/job location/i);

    fireEvent.change(titleInput, { target: { value: 'Fix leaking tap' } });
    fireEvent.change(descriptionInput, { target: { value: 'Kitchen tap drips constantly.' } });
    fireEvent.change(locationInput, { target: { value: '10 High Street, Glasgow' } });

    const submitButton = screen.getByRole('button', { name: /post job/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/jobs',
        expect.objectContaining({
          title: 'Fix leaking tap',
          description: 'Kitchen tap drips constantly.',
          locationText: '10 High Street, Glasgow',
        })
      );
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});
