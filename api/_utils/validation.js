import { ValidationError } from './errorHandler.js';

/**
 * Input validation and sanitization utilities
 * Prevents NoSQL injection and XSS attacks
 */

/**
 * Sanitize user input to prevent NoSQL injection
 * Removes MongoDB operators and special characters
 *
 * @param {any} input - User input to sanitize
 * @returns {any} - Sanitized input
 */
export function sanitizeInput(input) {
  if (input === null || input === undefined) {
    return input;
  }

  // Handle arrays
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  // Handle objects (remove MongoDB operators)
  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      // Remove keys that start with $ (MongoDB operators)
      if (!key.startsWith('$')) {
        sanitized[key] = sanitizeInput(value);
      }
    }
    return sanitized;
  }

  // Primitives pass through
  return input;
}

/**
 * Validate and sanitize string input
 *
 * @param {any} value - Input value
 * @param {Object} options - Validation options
 * @param {number} options.minLength - Minimum length
 * @param {number} options.maxLength - Maximum length
 * @param {boolean} options.required - Is required
 * @param {RegExp} options.pattern - Validation pattern
 * @returns {string|null} - Validated string or null
 * @throws {Error} - If validation fails
 */
export function validateString(value, options = {}) {
  const { minLength = 0, maxLength = 1000, required = false, pattern = null } = options;

  // Handle null/undefined
  if (value === null || value === undefined || value === '') {
    if (required) {
      throw new ValidationError('Value is required');
    }
    return null;
  }

  // Convert to string
  const str = String(value).trim();

  // Check length
  if (str.length < minLength) {
    throw new ValidationError(`Value must be at least ${minLength} characters`);
  }

  if (str.length > maxLength) {
    throw new ValidationError(`Value must not exceed ${maxLength} characters`);
  }

  // Check pattern
  if (pattern && !pattern.test(str)) {
    throw new ValidationError('Value format is invalid');
  }

  return str;
}

/**
 * Validate number input
 *
 * @param {any} value - Input value
 * @param {Object} options - Validation options
 * @param {number} options.min - Minimum value
 * @param {number} options.max - Maximum value
 * @param {boolean} options.required - Is required
 * @param {boolean} options.integer - Must be integer
 * @returns {number|null} - Validated number or null
 * @throws {Error} - If validation fails
 */
export function validateNumber(value, options = {}) {
  const { min = -Infinity, max = Infinity, required = false, integer = false } = options;

  // Handle null/undefined
  if (value === null || value === undefined || value === '') {
    if (required) {
      throw new ValidationError('Value is required');
    }
    return null;
  }

  // Convert to number
  const num = Number(value);

  // Check if valid number
  if (isNaN(num)) {
    throw new ValidationError('Value must be a valid number');
  }

  // Check integer
  if (integer && !Number.isInteger(num)) {
    throw new ValidationError('Value must be an integer');
  }

  // Check range
  if (num < min) {
    throw new ValidationError(`Value must be at least ${min}`);
  }

  if (num > max) {
    throw new ValidationError(`Value must not exceed ${max}`);
  }

  return num;
}

/**
 * Validate enum value
 *
 * @param {any} value - Input value
 * @param {Array} allowedValues - Allowed values
 * @param {boolean} required - Is required
 * @returns {any|null} - Validated value or null
 * @throws {Error} - If validation fails
 */
export function validateEnum(value, allowedValues, required = false) {
  // Handle null/undefined
  if (value === null || value === undefined || value === '') {
    if (required) {
      throw new ValidationError('Value is required');
    }
    return null;
  }

  if (!allowedValues.includes(value)) {
    throw new ValidationError(`Value must be one of: ${allowedValues.join(', ')}`);
  }

  return value;
}

/**
 * Validate ObjectId format
 *
 * @param {string} id - ObjectId string
 * @returns {boolean} - True if valid
 */
export function isValidObjectId(id) {
  if (!id || typeof id !== 'string') {
    return false;
  }

  // Check if it's a 24-character hex string
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Validate email format
 *
 * @param {string} email - Email address
 * @returns {boolean} - True if valid
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate coordinates
 *
 * @param {Object} coordinates - Coordinates object
 * @param {number} coordinates.lat - Latitude
 * @param {number} coordinates.lng - Longitude
 * @returns {Object} - Validated coordinates
 * @throws {Error} - If validation fails
 */
export function validateCoordinates(coordinates) {
  if (!coordinates || typeof coordinates !== 'object') {
    throw new ValidationError('Coordinates must be an object');
  }

  const lat = validateNumber(coordinates.lat, {
    min: -90,
    max: 90,
    required: true
  });

  const lng = validateNumber(coordinates.lng, {
    min: -180,
    max: 180,
    required: true
  });

  return { lat, lng };
}

/**
 * Validate date string
 *
 * @param {string} dateStr - Date string
 * @param {boolean} required - Is required
 * @returns {Date|null} - Validated Date object or null
 * @throws {Error} - If validation fails
 */
export function validateDate(dateStr, required = false) {
  if (!dateStr) {
    if (required) {
      throw new ValidationError('Date is required');
    }
    return null;
  }

  const date = new Date(dateStr);

  if (isNaN(date.getTime())) {
    throw new ValidationError('Invalid date format');
  }

  return date;
}

/**
 * Sanitize HTML to prevent XSS
 * Basic sanitization - removes script tags and event handlers
 *
 * @param {string} html - HTML string
 * @returns {string} - Sanitized HTML
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  return html
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '');
}

/**
 * Create validation error response
 *
 * @param {string} message - Error message
 * @param {string} field - Field name (optional)
 * @returns {Object} - Error response object
 */
export function createValidationError(message, field = null) {
  return {
    error: 'Validation error',
    message,
    ...(field && { field })
  };
}
