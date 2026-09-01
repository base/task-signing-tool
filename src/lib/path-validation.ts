import fs from 'fs';
import path from 'path';

/**
 * Validates that a resolved path is within the given directory.
 * Follows symlinks to prevent symlink-based path traversal.
 * Throws if the path escapes the directory (path traversal).
 * Returns the resolved (normalized) path.
 */
export function assertWithinDir(targetPath: string, allowedDir: string): string {
  const resolved = fs.realpathSync(targetPath);
  const dir = fs.realpathSync(allowedDir);
  if (!resolved.startsWith(dir + path.sep) && resolved !== dir) {
    throw new Error(`Path traversal detected: ${resolved} is outside allowed directory ${dir}`);
  }
  return resolved;
}
