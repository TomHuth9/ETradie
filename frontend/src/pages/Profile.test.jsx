import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const mockGet = vi.fn();
const mockPatch = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/client', () => ({
  default: {
    get: (...args) => mockGet(...args),
    patch: (...args) => mockPatch(...args),
    post: (...args) => mockPost(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

const mockLogout = vi.fn();
const mockUpdateToken = vi.fn();
let mockUser = {
  id: 1, role: 'HOMEOWNER', name: 'Grace Homeowner', email: 'grace@example.com',
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    updateToken: mockUpdateToken,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import Profile from './Profile';

const homeownerProfile = {
  id: 1, role: 'HOMEOWNER', name: 'Grace Homeowner', email: 'grace@example.com',
  addressLine1: '1 George Square', addressLine2: '', addressCity: 'Glasgow', addressPostcode: 'G2 1AL',
};

const tradespersonProfile = {
  id: 2, role: 'TRADESPERSON', name: 'Tom Tradesperson', email: 'tom@example.com',
  townOrCity: 'Glasgow', availability: true, workingHours: '', categories: ['PLUMBING'],
};

function mockApiFor(profile) {
  mockGet.mockImplementation((url) => {
    if (url === '/auth/me') return Promise.resolve({ data: profile });
    if (url === '/trades/categories') {
      return Promise.resolve({ data: [{ id: 'PLUMBING', label: 'Plumbing' }, { id: 'ELECTRICAL', label: 'Electrical' }] });
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

describe('Profile page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1, role: 'HOMEOWNER', name: 'Grace Homeowner', email: 'grace@example.com' };
  });

  test('loads and pre-fills the homeowner structured address fields', async () => {
    mockApiFor(homeownerProfile);
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByLabelText(/address line 1/i)).toHaveValue('1 George Square');
    });
    expect(screen.getByLabelText(/town \/ city/i)).toHaveValue('Glasgow');
    expect(screen.getByLabelText(/postcode/i)).toHaveValue('G2 1AL');
  });

  test('saves homeowner profile changes with the structured address payload', async () => {
    mockApiFor(homeownerProfile);
    mockPatch.mockResolvedValue({ data: {} });
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText(/full name/i)).toHaveValue('Grace Homeowner'));

    fireEvent.change(screen.getByLabelText(/address line 1/i), { target: { value: '2 New Street' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch).toHaveBeenCalledWith('/auth/profile', expect.objectContaining({
      addressLine1: '2 New Street',
      addressCity: 'Glasgow',
      addressPostcode: 'G2 1AL',
    }));
  });

  test('tradesperson profile shows town/city and categories instead of address fields', async () => {
    mockUser = { id: 2, role: 'TRADESPERSON', name: 'Tom Tradesperson', email: 'tom@example.com' };
    mockApiFor(tradespersonProfile);
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByLabelText(/^town \/ city$/i)).toHaveValue('Glasgow');
    });
    expect(screen.queryByLabelText(/address line 1/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /plumbing/i })).toBeInTheDocument();
    });
  });

  test('changing password swaps in the fresh token the backend returns', async () => {
    mockApiFor(homeownerProfile);
    mockPost.mockResolvedValue({ data: { message: 'Password updated', token: 'new-jwt-token' } });
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText(/full name/i)).toHaveValue('Grace Homeowner'));

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'OldPassword123' } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'NewPassword456' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'NewPassword456' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/auth/change-password', {
      currentPassword: 'OldPassword123',
      newPassword: 'NewPassword456',
    }));
    expect(mockUpdateToken).toHaveBeenCalledWith('new-jwt-token');
  });

  test('shows an error and does not submit when the new passwords do not match', async () => {
    mockApiFor(homeownerProfile);
    render(<MemoryRouter><Profile /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText(/full name/i)).toHaveValue('Grace Homeowner'));

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'OldPassword123' } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'NewPassword456' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'Mismatch789' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  describe('account deletion', () => {
    test('the confirmation form is hidden until "Delete my account" is clicked', async () => {
      mockApiFor(homeownerProfile);
      render(<MemoryRouter><Profile /></MemoryRouter>);

      await waitFor(() => expect(screen.getByLabelText(/full name/i)).toHaveValue('Grace Homeowner'));

      expect(screen.queryByLabelText(/enter your password to confirm/i)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
      expect(screen.getByLabelText(/enter your password to confirm/i)).toBeInTheDocument();
    });

    test('confirming with the correct password deletes the account and logs out', async () => {
      mockApiFor(homeownerProfile);
      mockDelete.mockResolvedValue({ data: { message: 'Account deleted' } });
      render(<MemoryRouter><Profile /></MemoryRouter>);

      await waitFor(() => expect(screen.getByLabelText(/full name/i)).toHaveValue('Grace Homeowner'));

      fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
      fireEvent.change(screen.getByLabelText(/enter your password to confirm/i), { target: { value: 'Password123' } });
      fireEvent.click(screen.getByRole('button', { name: /yes, permanently delete/i }));

      await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/auth/me', { data: { currentPassword: 'Password123' } }));
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    test('a failed deletion (wrong password) shows an error and does not log out', async () => {
      mockApiFor(homeownerProfile);
      mockDelete.mockRejectedValue({ response: { data: { message: 'Current password is incorrect' } } });
      render(<MemoryRouter><Profile /></MemoryRouter>);

      await waitFor(() => expect(screen.getByLabelText(/full name/i)).toHaveValue('Grace Homeowner'));

      fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
      fireEvent.change(screen.getByLabelText(/enter your password to confirm/i), { target: { value: 'WrongPassword' } });
      fireEvent.click(screen.getByRole('button', { name: /yes, permanently delete/i }));

      await waitFor(() => {
        expect(screen.getByText(/current password is incorrect/i)).toBeInTheDocument();
      });
      expect(mockLogout).not.toHaveBeenCalled();
    });

    test('cancel collapses the confirmation form without calling delete', async () => {
      mockApiFor(homeownerProfile);
      render(<MemoryRouter><Profile /></MemoryRouter>);

      await waitFor(() => expect(screen.getByLabelText(/full name/i)).toHaveValue('Grace Homeowner'));

      fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

      expect(screen.queryByLabelText(/enter your password to confirm/i)).not.toBeInTheDocument();
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
