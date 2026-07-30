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

  test('links "View details" to the job page', () => {
    renderCard();
    expect(screen.getByRole('link', { name: /view details/i })).toHaveAttribute('href', '/jobs/42');
  });

  test('does not render Accept/Decline buttons unless the handlers are provided', () => {
    renderCard();
    expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /decline/i })).not.toBeInTheDocument();
  });

  test('clicking Accept calls onAccept', () => {
    const onAccept = vi.fn();
    renderCard({ onAccept });
    fireEvent.click(screen.getByRole('button', { name: /^accept$/i }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  test('shows "Accepting…" and disables both buttons while accepting', () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    renderCard({ onAccept, onDecline, accepting: true });
    expect(screen.getByRole('button', { name: /accepting/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /decline/i })).toBeDisabled();
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
