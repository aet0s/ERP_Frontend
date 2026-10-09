/**
 * Validates and sanitizes a redirect target URL/path to prevent open redirect vulnerabilities.
 * Allows only relative paths starting with a single '/' and rejects protocol/scheme injection,
 * protocol-relative URLs ('//'), backslash bypasses ('/\\'), and control characters.
 *
 * @param {string | null | undefined} path
 * @returns {string | null}
 */
export function sanitizeRedirectPath(path) {
  if (!path || typeof path !== 'string') return null;
  const trimmed = path.trim();
  // Must start with a single '/' and not start with '//' or '/\'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return null;
  }
  // Reject dangerous protocols or schemes: http:, https:, javascript:, data:, vbscript:
  if (/^(http:|https:|javascript:|data:|vbscript:)/i.test(trimmed)) {
    return null;
  }
  // Reject if it contains control characters
  if (/[\r\n\t]/.test(trimmed)) {
    return null;
  }
  return trimmed;
}
