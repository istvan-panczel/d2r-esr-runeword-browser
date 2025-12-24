import { REMOTE_URLS } from './remoteConfig';

export async function fetchGemsHtml(): Promise<string> {
  const response = await fetch(REMOTE_URLS.gems);

  if (!response.ok) {
    throw new Error(`Failed to fetch gems.htm: ${String(response.status)} ${response.statusText}`);
  }

  return response.text();
}
