/**
 * Compare two version strings (X.Y.ZZ format)
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const parseVersion = (v: string): number[] => {
    return v.split('.').map((n) => parseInt(n, 10));
  };

  const aParts = parseVersion(a);
  const bParts = parseVersion(b);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] ?? 0;
    const bPart = bParts[i] ?? 0;

    if (aPart < bPart) return -1;
    if (aPart > bPart) return 1;
  }

  return 0;
}

/**
 * Check if remote version is different from stored version
 */
export function isVersionDifferent(stored: string | null, remote: string): boolean {
  if (stored === null) return true;
  return compareVersions(stored, remote) !== 0;
}
