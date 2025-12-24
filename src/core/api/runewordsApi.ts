import { REMOTE_URLS } from './remoteConfig';

export async function fetchRunewordsHtml(): Promise<string> {
  const response = await fetch(REMOTE_URLS.runewords);

  if (!response.ok) {
    throw new Error(`Failed to fetch runewords.htm: ${String(response.status)} ${response.statusText}`);
  }

  return response.text();
}
