/**
 * Content Security Policy utilities for Cloudflare Workers
 * Builds CSP headers with nonce support for enhanced security
 */

/**
 * Generates a cryptographically secure nonce
 * @param {number} byteLen - Length in bytes
 * @returns {string} - Base64url encoded nonce
 */
export function makeNonce(byteLen = 16) {
  const buf = new Uint8Array(byteLen);
  crypto.getRandomValues(buf);
  // Base64url without padding
  const b64 = btoa(String.fromCharCode(...buf));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Builds a Content Security Policy string
 * @param {string} nonce - Nonce for script/style tags
 * @param {object} options - Additional CSP options
 * @returns {string} - CSP header value
 */
export function buildCsp(nonce, options = {}) {
  const connectSrc = ["'self'", 'https://api.github.com', ...(options.connectSrc || [])];
  
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`],
    "style-src": ["'self'", "'unsafe-inline'"], // TODO: Use nonce for styles
    "img-src": ["'self'", 'data:', 'https:'],
    "connect-src": connectSrc,
    "font-src": ["'self'"],
    "object-src": ["'none'"],
    "media-src": ["'self'"],
    "frame-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "upgrade-insecure-requests": [],
  };
  
  return Object.entries(directives)
    .map(([key, values]) => values.length ? `${key} ${values.join(' ')}` : key)
    .filter(Boolean)
    .join('; ');
}

/**
 * Returns security headers including CSP
 * @param {string} nonce - Nonce for CSP
 * @param {object} options - Additional options
 * @returns {object} - Headers object
 */
export function securityHeaders(nonce, options = {}) {
  return {
    'Content-Security-Policy': buildCsp(nonce, options),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  };
}

/**
 * Adds security headers to a response
 * @param {Response} response - Original response
 * @param {string} nonce - CSP nonce
 * @returns {Response} - Response with security headers
 */
export function withSecurityHeaders(response, nonce) {
  const newResponse = new Response(response.body, response);
  const headers = securityHeaders(nonce);
  
  for (const [key, value] of Object.entries(headers)) {
    newResponse.headers.set(key, value);
  }
  
  return newResponse;
}