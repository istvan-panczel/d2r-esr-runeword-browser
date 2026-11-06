/** Items in the parsed challenge text worth a Drop Finder link (the orbs are linked in the orb table) */
const DROP_FINDER_TERM = /Primordial Soulstones?/;

/** The first Drop Finder item in a text: where it starts and how it is spelled there */
export function findDropFinderTerm(text: string): { readonly index: number; readonly term: string } | null {
  const match = DROP_FINDER_TERM.exec(text);
  return match ? { index: match.index, term: match[0] } : null;
}
