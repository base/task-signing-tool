import path from 'path';

/**
 * Validates that a resolved path is within the given directory.
 * Throws if the path escapes the directory (path traversal).
 * Returns the resolved (normalized) path.
 */
export function assertWithinDir(targetPath: string, allowedDir: string): string {
  const resolved = path.resolve(targetPath);
  const dir = path.resolve(allowedDir);
  if (!resolved.startsWith(dir + path.sep) && resolved !== dir) {
    throw new Error(`Path traversal detected: ${resolved} is outside allowed directory ${dir}`);
  }
  return resolved;
}

const SAFE_PATH_SEGMENT_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isSafePathSegment(value: string): boolean {
  return SAFE_PATH_SEGMENT_PATTERN.test(value);
}
