/** The My Stash pages listed on the overview. A new stash page goes here, in the router and in the menu (`navConfig.ts`). */
export const STASH_PAGES = [
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
