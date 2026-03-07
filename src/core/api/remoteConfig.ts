// Base URL for ESR documentation
export const ESR_BASE_URL = 'https://easternsunresurrected.com';

// Remote data URLs
export const REMOTE_URLS = {
  changelog: `${ESR_BASE_URL}/changelogs.html`,
  gems: `${ESR_BASE_URL}/gems.htm`,
  runewords: `${ESR_BASE_URL}/runewords.htm`,
  uniqueWeapons: `${ESR_BASE_URL}/unique_weapons.htm`,
  uniqueArmors: `${ESR_BASE_URL}/unique_armors.htm`,
  uniqueOthers: `${ESR_BASE_URL}/unique_others.htm`,
} as const;
