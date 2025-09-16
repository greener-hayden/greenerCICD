/**
 * Input validation utilities for Cloudflare Workers
 * Centralized validation for query params and JSON bodies
 */

/**
 * Validates and parses a required string parameter
 * @param {*} value - Value to validate
 * @param {string} name - Parameter name for error messages
 * @param {number} maxLen - Maximum allowed length
 * @returns {string} - Validated string
 * @throws {Response} - 400 error if validation fails
 */
export function parseRequiredString(value, name, maxLen = 2000) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Response(`Missing or invalid ${name}`, { status: 400 });
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLen) {
    throw new Response(`${name} too long`, { status: 413 });
  }
  return trimmed;
}

/**
 * Validates and parses an optional string parameter
 * @param {*} value - Value to validate
 * @param {string} name - Parameter name for error messages
 * @param {number} maxLen - Maximum allowed length
 * @returns {string|null} - Validated string or null
 */
export function parseOptionalString(value, name, maxLen = 2000) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return parseRequiredString(value, name, maxLen);
}

/**
 * Validates and parses a positive integer
 * @param {*} value - Value to validate
 * @param {string} name - Parameter name for error messages
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Validated integer
 * @throws {Response} - 400 error if validation fails
 */
export function parsePositiveInt(value, name, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Response(`Invalid ${name}`, { status: 400 });
  }
  return n;
}

/**
 * Reads and validates JSON from request body
 * @param {Request} req - Request object
 * @param {number} maxBytes - Maximum body size in bytes
 * @returns {Promise<*>} - Parsed JSON
 * @throws {Response} - Error response if validation fails
 */
export async function readJson(req, maxBytes = 256000) {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Response('Expected application/json', { status: 415 });
  }
  
  const bytes = await req.arrayBuffer();
  if (bytes.byteLength > maxBytes) {
    throw new Response('Payload too large', { status: 413 });
  }
  
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new Response('Invalid JSON', { status: 400 });
  }
}

/**
 * Validates an array of strings
 * @param {*} value - Value to validate
 * @param {string} name - Parameter name for error messages
 * @param {number} maxItems - Maximum number of items
 * @returns {string[]} - Validated array
 * @throws {Response} - 400 error if validation fails
 */
export function parseStringArray(value, name, maxItems = 100) {
  if (!Array.isArray(value)) {
    throw new Response(`${name} must be an array`, { status: 400 });
  }
  
  if (value.length > maxItems) {
    throw new Response(`Too many items in ${name}`, { status: 413 });
  }
  
  const validated = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new Response(`All items in ${name} must be strings`, { status: 400 });
    }
    validated.push(item.trim());
  }
  
  return validated;
}