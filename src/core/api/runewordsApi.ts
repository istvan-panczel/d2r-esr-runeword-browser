export async function fetchRunewordsHtml(): Promise<string> {
  const response = await fetch('/data/runewords.htm');

  if (!response.ok) {
    throw new Error(`Failed to fetch runewords.htm: ${String(response.status)} ${response.statusText}`);
  }

  return response.text();
}
