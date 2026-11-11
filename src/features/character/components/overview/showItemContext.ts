import { createContext } from 'react';

/** Opens the Gear tab on a player item (by its index), when the page offers it; null elsewhere */
export const ShowItemContext = createContext<((index: number) => void) | null>(null);
