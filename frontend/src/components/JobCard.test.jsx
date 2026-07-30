import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import JobCard from './JobCard';

const baseJob = {
  id: 42,
  title: 'Fix leaking radiator',
  category: 'PLUMBING',
  categoryLabel: 'Plumbing',
  locationText: '10 High Street, Glasgow',
  description: 'Radiator in the living room is leaking.',
  status: 'PENDING',
};

function renderCard(props = {}) {
  return render(
    <MemoryRouter>
      <JobCard job={{ ...baseJob, ...props.job }} {...props} />
    </MemoryRouter>
  );
}

describe('JobCard', () => {
  test('renders title, category, location, and description', () => {
    renderCard();
    expect(screen.getByText('Fix leaking radiator')).toBeInTheDocument();
    expect(screen.getByText('Plumbing')).toBeInTheDocument();
    expect(screen.getByText(/10 High Street, Glasgow/)).toBeInTheDocument();
    expect(screen.getByText(/Radiator in the living room is leaking\./)).toBeInTheDocument();
  });

  test('renders a status badge when the job has a status', () => {
    renderCard({ job: { status: 'ACCEPTED' } });
    expect(screen.getByText('ACCEPTED')).toBeInTheDocument();
  });

  test('shows a "New" badge only when isNew is true', () => {
    const { rerender } = render(
      <MemoryRouter><JobCard job={baseJob} isNew /></MemoryRouter>
    );
    expect(screen.getByText(/new/i)).toBeInTheDocument();

    rerender(<MemoryRouter><JobCard job={baseJob} isNew={false} /></MemoryRouter>);
    expect(screen.queryByText(/^new$/i)).not.toBeInTheDocument();
  });

  test('links "View & quote" to the job page', () => {
    renderCard();
    expect(screen.getByRole('link', { name: /view & quote/i })).toHaveAttribute('href', '/jobs/42');
  });

  test('does not render a Decline button unless onDecline is provided', () => {
    renderCard();
    expect(screen.queryByRole('button', { name: /decline/i })).not.toBeInTheDocument();
  });

  test('shows "Declining…" and disables the Decline button while declining', () => {
    const onDecline = vi.fn();
    renderCard({ onDecline, declining: true });
    expect(screen.getByRole('button', { name: /declining/i })).toBeDisabled();
  });

  test('Decline asks for confirmation and only calls onDecline if confirmed', () => {
    const onDecline = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderCard({ onDecline });

    fireEvent.click(screen.getByRole('button', { name: /decline/i }));
    expect(confirmSpy).toHaveBeenCalledWith('Decline this job?');
    expect(onDecline).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /decline/i }));
    expect(onDecline).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
  });
});
