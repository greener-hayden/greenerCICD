/**
 * Environment variable validation for Cloudflare Workers
 * Ensures required environment variables are properly configured
 */

/**
 * Validates that required environment variables are present
 * @param {object} env - Environment object from Cloudflare Workers
 * @throws {Error} - If required variables are missing
 */
export function validateEnv(env) {
  if (!env || typeof env !== 'object') {
    throw new Error('Server misconfiguration: env is unavailable');
  }

  // Check for required environment variables
  if (!env.GITHUB_TOKEN || typeof env.GITHUB_TOKEN !== 'string' || env.GITHUB_TOKEN.length === 0) {
    throw new Error('Server misconfiguration: GITHUB_TOKEN is not set');
  }

  // Additional optional validations
  if (env.GITHUB_APP_ID && typeof env.GITHUB_APP_ID !== 'string') {
    throw new Error('Server misconfiguration: GITHUB_APP_ID must be a string');
  }

  if (env.GITHUB_PRIVATE_KEY && typeof env.GITHUB_PRIVATE_KEY !== 'string') {
    throw new Error('Server misconfiguration: GITHUB_PRIVATE_KEY must be a string');
  }
}

/**
 * Gets and validates environment variables
 * @param {object} env - Environment object
 * @returns {object} - Validated environment object
 */
export function getEnv(env) {
  validateEnv(env);
  return env;
}

/**
 * Gets an environment variable with a default value
 * @param {object} env - Environment object
 * @param {string} key - Environment variable key
 * @param {*} defaultValue - Default value if not found
 * @returns {*} - Environment variable value or default
 */
export function getEnvVar(env, key, defaultValue = undefined) {
  if (env && typeof env === 'object' && key in env) {
    return env[key];
  }
  return defaultValue;
}