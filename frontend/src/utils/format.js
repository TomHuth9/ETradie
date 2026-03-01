/**
 * Format an ISO date string for display (e.g. "15 Jan 2025" or "Posted 2 hours ago").
 */
export function formatJobDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getStatusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'pending') return 'badge-pending';
  if (s === 'accepted') return 'badge-accepted';
  if (s === 'completed') return 'badge-completed';
  if (s === 'cancelled') return 'badge-cancelled';
  if (s === 'closed') return 'badge-cancelled';
  return 'badge-pending';
}
