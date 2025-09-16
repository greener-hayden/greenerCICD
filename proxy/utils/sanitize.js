/**
 * HTML sanitization utilities for Cloudflare Workers
 * Prevents XSS by escaping dangerous characters in user input
 */

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
  '=': '&#61;',
  '/': '&#47;',
};

const ESCAPE_RE = /[&<>"'`=\/]/g;

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {*} input - The input to escape
 * @returns {string} - The escaped string
 */
export function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(ESCAPE_RE, (ch) => ESCAPE_MAP[ch] || ch);
}

/**
 * Safe HTML template tag that auto-escapes all interpolations
 * @param {TemplateStringsArray} literals - Template literals
 * @param {...*} values - Values to interpolate
 * @returns {string} - Safe HTML string
 */
export function html(literals, ...values) {
  let out = '';
  for (let i = 0; i < literals.length; i++) {
    out += literals[i];
    if (i < values.length) out += escapeHtml(values[i]);
  }
  return out;
}

/**
 * Mark a string as raw HTML (use sparingly and only with trusted content)
 * @param {string} unescaped - Raw HTML string
 * @returns {object} - Marked raw HTML object
 */
export function raw(unescaped) {
  return { __raw: true, value: unescaped };
}

/**
 * Process template values, handling raw HTML markers
 * @param {*} value - Value to process
 * @returns {string} - Processed string
 */
export function processValue(value) {
  if (value && typeof value === 'object' && value.__raw) {
    return value.value;
  }
  return escapeHtml(value);
}

/**
 * Enhanced HTML template tag that supports raw HTML markers
 * @param {TemplateStringsArray} literals - Template literals
 * @param {...*} values - Values to interpolate
 * @returns {string} - Safe HTML string
 */
export function safeHtml(literals, ...values) {
  let out = '';
  for (let i = 0; i < literals.length; i++) {
    out += literals[i];
    if (i < values.length) out += processValue(values[i]);
  }
  return out;
}