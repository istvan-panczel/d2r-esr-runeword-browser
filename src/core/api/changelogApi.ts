import { REMOTE_URLS } from './remoteConfig';

export interface ChangelogVersion {
  readonly version: string; // "3.9.09"
  readonly fullString: string; // "Eastern Sun Resurrected 3.9.09 - 22/12/2025"
  readonly date: string; // "22/12/2025"
}

// Regex pattern to match version string
const VERSION_PATTERN = /Eastern\s+Sun\s+Resurrected\s+(\d+\.\d+\.\d+)\s+-\s+(\d{2}\/\d{2}\/\d{4})/;

export async function fetchLatestVersion(): Promise<ChangelogVersion> {
  const response = await fetch(REMOTE_URLS.changelog);

  if (!response.ok) {
    throw new Error(`Failed to fetch changelog: ${String(response.status)} ${response.statusText}`);
  }

  const html = await response.text();
  const match = VERSION_PATTERN.exec(html);

  if (!match) {
    throw new Error('Could not parse version from changelog');
  }

  return {
    version: match[1],
    fullString: match[0],
    date: match[2],
  };
}
