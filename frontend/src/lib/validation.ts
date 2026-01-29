// Validation utilities for form fields

export const validators = {
  // Email validation - RFC 5322 compliant (simplified)
  email: (value: string): boolean => {
    if (!value) return true; // Empty is valid (use required separately)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return emailRegex.test(value.trim());
  },

  // Phone validation - allows various formats
  phone: (value: string): boolean => {
    if (!value) return true;
    // Remove all formatting characters
    const cleaned = value.replace(/[\s\-().+]/g, '');
    // Should be 7-15 digits
    return /^\d{7,15}$/.test(cleaned);
  },

  // URL validation
  url: (value: string): boolean => {
    if (!value) return true;
    try {
      const url = new URL(value.startsWith('http') ? value : `https://${value}`);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  },

  // LinkedIn URL validation
  linkedinUrl: (value: string): boolean => {
    if (!value) return true;
    const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company)\/[\w-]+\/?$/i;
    return linkedinRegex.test(value);
  },

  // Twitter handle validation
  twitterHandle: (value: string): boolean => {
    if (!value) return true;
    // Remove @ if present, then validate
    const handle = value.startsWith('@') ? value.slice(1) : value;
    return /^[A-Za-z0-9_]{1,15}$/.test(handle);
  },

  // Password strength validation
  password: (value: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (value.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(value)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(value)) errors.push('One lowercase letter');
    if (!/[0-9]/.test(value)) errors.push('One number');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) errors.push('One special character');
    return { valid: errors.length === 0, errors };
  },

  // Required field validation
  required: (value: unknown): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  },

  // Min length validation
  minLength: (value: string, min: number): boolean => {
    if (!value) return true;
    return value.length >= min;
  },

  // Max length validation
  maxLength: (value: string, max: number): boolean => {
    if (!value) return true;
    return value.length <= max;
  },

  // Number range validation
  numberRange: (value: number, min?: number, max?: number): boolean => {
    if (min !== undefined && value < min) return false;
    if (max !== undefined && value > max) return false;
    return true;
  },

  // Date in future validation
  futureDate: (value: string): boolean => {
    if (!value) return true;
    const date = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  },

  // Date in past validation
  pastDate: (value: string): boolean => {
    if (!value) return true;
    const date = new Date(value);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date <= today;
  },

  // Date range validation (start before end)
  dateRange: (startDate: string, endDate: string): boolean => {
    if (!startDate || !endDate) return true;
    return new Date(startDate) <= new Date(endDate);
  },
};

// Error messages for validation
export const validationMessages = {
  email: 'Please enter a valid email address',
  phone: 'Please enter a valid phone number',
  url: 'Please enter a valid URL (e.g., https://example.com)',
  linkedinUrl: 'Please enter a valid LinkedIn URL',
  twitterHandle: 'Please enter a valid Twitter handle (1-15 characters, letters, numbers, underscores)',
  password: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
  required: 'This field is required',
  minLength: (min: number) => `Must be at least ${min} characters`,
  maxLength: (max: number) => `Must be no more than ${max} characters`,
  futureDate: 'Date must be in the future',
  pastDate: 'Date must be in the past',
  dateRange: 'End date must be after start date',
};

// Format phone number for display
export function formatPhoneNumber(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  if (cleaned.length <= 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  // International format
  return `+${cleaned.slice(0, cleaned.length - 10)} (${cleaned.slice(-10, -7)}) ${cleaned.slice(-7, -4)}-${cleaned.slice(-4)}`;
}

// Normalize URL (add https:// if missing)
export function normalizeUrl(value: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

// Normalize Twitter handle (remove @ if present)
export function normalizeTwitterHandle(value: string): string {
  if (!value) return '';
  return value.startsWith('@') ? value.slice(1) : value;
}
