// Joins a structured homeowner address into a single display/prefill string.
export function formatAddress({ addressLine1, addressLine2, addressCity, addressPostcode }) {
  return [addressLine1, addressLine2, addressCity, addressPostcode]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(', ');
}
