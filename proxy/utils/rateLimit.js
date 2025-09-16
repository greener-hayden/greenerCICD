/**
 * Rate limiting utilities for Cloudflare Workers
 * KV-based fixed window rate limiter
 */

/**
 * Rate limit error class
 */
export class RateLimitError extends Error {
  constructor(message = 'Too Many Requests', retryAfterSec = 60) {
    super(message);
    this.name = 'RateLimitError';
    this.status = 429;
    this.retryAfter = retryAfterSec;
  }
}

/**
 * Enforces rate limiting using KV storage
 * @param {object} env - Environment with RATE_LIMIT_KV binding
 * @param {string} key - Rate limit key (e.g., IP address)
 * @param {number} limit - Maximum requests per window
 * @param {number} windowSec - Window duration in seconds
 * @returns {Promise<void>}
 * @throws {RateLimitError} - If rate limit exceeded
 */
export async function enforceRateLimit(env, key, limit = 60, windowSec = 60) {
  // Soft-disable if KV not configured
  if (!env.RATE_LIMIT_KV) return;
  
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const kvKey = `rl:${key}:${bucket}`;
  
  const current = Number((await env.RATE_LIMIT_KV.get(kvKey)) || '0');
  
  if (current >= limit) {
    throw new RateLimitError('Rate limit exceeded', windowSec);
  }
  
  await env.RATE_LIMIT_KV.put(kvKey, String(current + 1), {
    expirationTtl: windowSec
  });
}

/**
 * Derives a client key from request for rate limiting
 * @param {Request} req - Request object
 * @returns {string} - Client identifier
 */
export function getClientKey(req) {
  // Try to get client IP from Cloudflare headers
  const ip = req.headers.get('cf-connecting-ip') ||
             req.headers.get('x-forwarded-for') ||
             req.headers.get('x-real-ip');
  
  if (ip) {
    const url = new URL(req.url);
    return `${ip}:${url.pathname}`;
  }
  
  // Fallback to user agent + path
  const ua = req.headers.get('user-agent') || 'unknown';
  const url = new URL(req.url);
  return `${ua}:${url.pathname}`;
}

/**
 * Checks remaining rate limit without incrementing
 * @param {object} env - Environment with RATE_LIMIT_KV
 * @param {string} key - Rate limit key
 * @param {number} limit - Maximum requests
 * @param {number} windowSec - Window duration
 * @returns {Promise<{remaining: number, reset: number}>}
 */
export async function checkRateLimit(env, key, limit = 60, windowSec = 60) {
  if (!env.RATE_LIMIT_KV) {
    return { remaining: limit, reset: 0 };
  }
  
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const kvKey = `rl:${key}:${bucket}`;
  
  const current = Number((await env.RATE_LIMIT_KV.get(kvKey)) || '0');
  const remaining = Math.max(0, limit - current);
  const reset = (bucket + 1) * windowSec;
  
  return { remaining, reset };
}

/**
 * Adds rate limit headers to response
 * @param {Response} response - Original response
 * @param {object} rateLimitInfo - Rate limit info
 * @returns {Response} - Response with rate limit headers
 */
export function withRateLimitHeaders(response, rateLimitInfo) {
  const newResponse = new Response(response.body, response);
  
  if (rateLimitInfo) {
    newResponse.headers.set('X-RateLimit-Limit', String(rateLimitInfo.limit || 60));
    newResponse.headers.set('X-RateLimit-Remaining', String(rateLimitInfo.remaining || 0));
    newResponse.headers.set('X-RateLimit-Reset', String(rateLimitInfo.reset || 0));
  }
  
  return newResponse;
}