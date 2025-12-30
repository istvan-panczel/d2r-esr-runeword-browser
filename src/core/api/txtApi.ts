import type { TxtFilesData } from '@/core/db';

// Base URL for TXT files in public folder
// Uses Vite's BASE_URL to handle different base paths (dev vs production)
const TXT_BASE_URL = `${import.meta.env.BASE_URL}txt`;

/**
 * Fetch a single TXT file from the assets folder
 */
export async function fetchTxtFile(filename: string): Promise<string> {
  const response = await fetch(`${TXT_BASE_URL}/${filename}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${filename}: ${String(response.status)} ${response.statusText}`);
  }

  return response.text();
}

/**
 * Fetch all required TXT files in parallel
 */
export async function fetchAllTxtFiles(): Promise<TxtFilesData> {
  const [properties, gems, runes, uniqueItems, sets, setItems, weapons, armor, misc, itemTypes, cubemain] = await Promise.all([
    fetchTxtFile('properties.txt'),
    fetchTxtFile('gems.txt'),
    fetchTxtFile('runes.txt'),
    fetchTxtFile('uniqueitems.txt'),
    fetchTxtFile('sets.txt'),
    fetchTxtFile('setitems.txt'),
    fetchTxtFile('weapons.txt'),
    fetchTxtFile('armor.txt'),
    fetchTxtFile('misc.txt'),
    fetchTxtFile('itemtypes.txt'),
    fetchTxtFile('cubemain.txt'),
  ]);

  return {
    properties,
    gems,
    runes,
    uniqueItems,
    sets,
    setItems,
    weapons,
    armor,
    misc,
    itemTypes,
    cubemain,
  };
}
