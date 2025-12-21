export async function fetchGemsHtml(): Promise<string> {
  const response = await fetch('/data/gems.htm');

  if (!response.ok) {
    throw new Error(`Failed to fetch gems.htm: ${String(response.status)} ${response.statusText}`);
  }

  return response.text();
}
