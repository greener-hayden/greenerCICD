/**
 * HTTP utilities for Cloudflare Workers
 * Common helpers for responses, caching, and CSRF protection
 */

import { makeNonce, withSecurityHeaders } from './csp.js';

/**
 * Creates a response with security headers
 * @param {BodyInit} body - Response body
 * @param {ResponseInit} init - Response init options
 * @returns {Response} - Response with security headers
 */
export function ok(body, init = {}) {
  const nonce = makeNonce();
  const headers = new Headers(init.headers || {});
  
  // Set default cache control if not provided
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  
  const response = new Response(body, {
    ...init,
    headers
  });
  
  return withSecurityHeaders(response, nonce);
}

/**
 * Caches GET responses using Cloudflare cache API
 * @param {Request} req - Request object
 * @param {number} ttlSeconds - Cache TTL in seconds
 * @param {Function} handler - Handler function
 * @returns {Promise<Response>} - Cached or fresh response
 */
export async function cachedGet(req, ttlSeconds, handler) {
  if (req.method !== 'GET') return handler();
  
  const cache = caches.default;
  const cacheKey = new Request(req.url, req);
  
  // Check cache
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  
  // Generate fresh response
  const response = await handler();
  
  // Only cache successful responses
  if (response.ok && response.status === 200) {
    const responseToCache = new Response(response.body, response);
    responseToCache.headers.set('Cache-Control', `public, max-age=${ttlSeconds}`);
    
    // Don't await cache.put to avoid blocking response
    cache.put(cacheKey, responseToCache.clone());
  }
  
  return response;
}

/**
 * Sets CSRF cookie
 * @param {Headers} headers - Headers object
 * @param {string} token - CSRF token
 */
export function setCsrfCookie(headers, token) {
  headers.append(
    'Set-Cookie',
    `csrf=${token}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=86400`
  );
}

/**
 * Gets CSRF token from cookie
 * @param {Request} req - Request object
 * @returns {string|null} - CSRF token or null
 */
export function getCsrfToken(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const csrfCookie = cookies.find(c => c.startsWith('csrf='));
  return csrfCookie ? csrfCookie.substring(5) : null;
}

/**
 * Validates CSRF token for state-changing requests
 * @param {Request} req - Request object
 * @throws {Response} - 403 if CSRF validation fails
 */
export function requireCsrf(req) {
  // Only enforce for state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
  
  const headerToken = req.headers.get('x-csrf-token') || '';
  const cookieToken = getCsrfToken(req);
  
  if (!headerToken || headerToken !== cookieToken) {
    throw new Response('CSRF token invalid', { status: 403 });
  }
}

/**
 * Creates a JSON response with proper headers
 * @param {*} data - Data to serialize
 * @param {ResponseInit} init - Response init options
 * @returns {Response} - JSON response
 */
export function json(data, init = {}) {
  const body = JSON.stringify(data);
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  
  return ok(body, {
    ...init,
    headers
  });
}

/**
 * Creates an HTML response with proper headers
 * @param {string} html - HTML content
 * @param {ResponseInit} init - Response init options
 * @returns {Response} - HTML response
 */
export function html(html, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'text/html; charset=utf-8');
  
  return ok(html, {
    ...init,
    headers
  });
}

/**
 * Standard error response
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Response} - Error response
 */
export function error(message, status = 500) {
  return new Response(JSON.stringify({
    error: message,
    status
  }), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}