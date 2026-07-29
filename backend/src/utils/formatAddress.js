// Joins a structured homeowner address into the single-line string the
// geocoding service (and anywhere else a display string is needed) expects.
function formatAddress({ addressLine1, addressLine2, addressCity, addressPostcode }) {
  return [addressLine1, addressLine2, addressCity, addressPostcode]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(', ');
}

module.exports = { formatAddress };
