/** The My Stash sub-pages: the layout tabs and the overview's feature list. Add a stash feature here and in the router. */
export const STASH_PAGES = [
  { to: '/stash', label: 'Overview', description: 'Upload the stash file and see what the pages can do with it' },
  {
    to: '/stash/coupons',
    label: 'Ancient Coupons',
    description: 'The coupons you own, the uniques they make, how many you need, the Wild Card recipe and where each coupon lies',
  },
  {
    to: '/stash/items',
    label: 'All Items',
    description: 'Every item on your stash pages with its name, quality, tier and place: search names and stats, filter and sort',
  },
] as const;
