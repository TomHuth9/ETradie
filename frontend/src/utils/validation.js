/**
 * Client-side validation matching backend rules (Zod schemas).
 * All functions return an error message string or null if valid.
 */

const LIMITS = {
  name: 100,
  email: 254,
  address: 255,
  townOrCity: 255,
  jobTitle: 140,
  jobDescription: 4000,
  locationText: 255,
  messageContent: 4000,
  reviewComment: 4000,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return 'Name is required';
  if (s.length > LIMITS.name) return `Name must be ${LIMITS.name} characters or fewer`;
  return null;
}

export function validateEmail(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return 'Email is required';
  if (s.length > LIMITS.email) return 'Email is too long';
  if (!EMAIL_REGEX.test(s)) return 'Please enter a valid email address';
  return null;
}

export function validatePassword(value) {
  const s = typeof value === 'string' ? value : '';
  if (!s) return 'Password is required';
  if (s.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(s)) return 'Include at least one uppercase letter';
  if (!/[a-z]/.test(s)) return 'Include at least one lowercase letter';
  if (!/[0-9]/.test(s)) return 'Include at least one number';
  return null;
}

export function validateAddress(value, required = true) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (required && !s) return 'Address is required';
  if (s && s.length > LIMITS.address) return `Address must be ${LIMITS.address} characters or fewer`;
  return null;
}

export function validateTownOrCity(value, required = true) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (required && !s) return 'Town or city is required';
  if (s && s.length > LIMITS.townOrCity) return `Town/city must be ${LIMITS.townOrCity} characters or fewer`;
  return null;
}

export function validateJobTitle(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return 'Title is required';
  if (s.length > LIMITS.jobTitle) return `Title must be ${LIMITS.jobTitle} characters or fewer`;
  return null;
}

export function validateJobDescription(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return 'Description is required';
  if (s.length > LIMITS.jobDescription) return `Description must be ${LIMITS.jobDescription} characters or fewer`;
  return null;
}

export function validateLocationText(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return 'Location is required';
  if (s.length > LIMITS.locationText) return `Location must be ${LIMITS.locationText} characters or fewer`;
  return null;
}

export function validateMessageContent(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return 'Message is required';
  if (s.length > LIMITS.messageContent) return `Message must be ${LIMITS.messageContent} characters or fewer`;
  return null;
}

export function validateReviewComment(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (s && s.length > LIMITS.reviewComment) return `Comment must be ${LIMITS.reviewComment} characters or fewer`;
  return null;
}

/** Password hint for live feedback (Register/Profile) — returns { valid: boolean, message: string } */
export function getPasswordHint(value) {
  const s = typeof value === 'string' ? value : '';
  if (!s) return { valid: false, message: '' };
  if (s.length < 8) return { valid: false, message: 'Use at least 8 characters.' };
  if (!/[A-Z]/.test(s) || !/[a-z]/.test(s) || !/[0-9]/.test(s)) {
    return { valid: false, message: 'Include at least one uppercase letter, one lowercase letter, and one number.' };
  }
  return { valid: true, message: 'Looks good.' };
}

export { LIMITS };
