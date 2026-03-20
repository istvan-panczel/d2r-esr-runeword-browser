import { REMOTE_URLS } from './remoteConfig';

export async function fetchUniqueMythicalsHtml(): Promise<string> {
  const response = await fetch(REMOTE_URLS.uniqueMythicals);

  if (!response.ok) {
    throw new Error(`Failed to fetch unique_mythicals.htm: ${String(response.status)} ${response.statusText}`);
  }

  return response.text();
}
