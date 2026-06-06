import { REMOTE_URLS } from './remoteConfig';

export async function fetchGemwordsHtml(): Promise<string> {
  const response = await fetch(REMOTE_URLS.gemwords);

  if (!response.ok) {
    throw new Error(`Failed to fetch gemwords.htm: ${String(response.status)} ${response.statusText}`);
  }

  return response.text();
}
