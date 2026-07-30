import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const mockVerifyEmail = vi.fn();
const mockResendVerification = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    verifyEmail: (...args) => mockVerifyEmail(...args),
    resendVerification: (...args) => mockResendVerification(...args),
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import VerifyEmail from './VerifyEmail';

function renderWithEmail(email = 'grace@example.com') {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/verify-email', state: { email } }]}>
      <VerifyEmail />
    </MemoryRouter>
  );
}

describe('VerifyEmail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('pre-fills the email address passed via navigation state', () => {
    renderWithEmail('grace@example.com');
    expect(screen.getByLabelText(/email address/i)).toHaveValue('grace@example.com');
  });

  test('renders with an empty email field when none was passed', () => {
    render(<MemoryRouter><VerifyEmail /></MemoryRouter>);
    expect(screen.getByLabelText(/email address/i)).toHaveValue('');
  });

  test('the code field strips non-digits and caps at 6 characters', () => {
    renderWithEmail();
    const codeInput = screen.getByLabelText(/verification code/i);
    fireEvent.change(codeInput, { target: { value: 'ab12cd34ef56' } });
    expect(codeInput).toHaveValue('123456');
  });

  test('rejects submission with a code shorter than 6 digits', async () => {
    renderWithEmail();
    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /verify email/i }));

    // The page's static instructional text also starts with "Enter the
    // 6-digit code...", so match the error's full, distinct wording.
    await waitFor(() => {
      expect(screen.getByText(/enter the 6-digit code from your email/i)).toBeInTheDocument();
    });
    expect(mockVerifyEmail).not.toHaveBeenCalled();
  });

  test('submits the trimmed, lowercased email and code on success', async () => {
    mockVerifyEmail.mockResolvedValue({});
    renderWithEmail('  Grace@Example.com  ');
    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verify email/i }));

    await waitFor(() => expect(mockVerifyEmail).toHaveBeenCalledWith('grace@example.com', '123456'));
  });

  test('shows the server error message when verification fails', async () => {
    mockVerifyEmail.mockRejectedValue({ response: { data: { message: 'Invalid or expired verification code' } } });
    renderWithEmail();
    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '999999' } });
    fireEvent.click(screen.getByRole('button', { name: /verify email/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid or expired verification code/i)).toBeInTheDocument();
    });
  });

  test('resend button calls resendVerification with the current email', async () => {
    mockResendVerification.mockResolvedValue({});
    renderWithEmail('grace@example.com');
    fireEvent.click(screen.getByRole('button', { name: /resend/i }));

    await waitFor(() => expect(mockResendVerification).toHaveBeenCalledWith('grace@example.com'));
  });
});
