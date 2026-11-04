# Security Policy

## Reporting a vulnerability

Please report security problems privately, not in a public issue:

- **Preferred:** use GitHub's private reporting form: the
  [Report a vulnerability](https://github.com/istvan-panczel/d2r-esr-runeword-browser/security/advisories/new) button
  on the repository's **Security** tab.
- **Or email:** mirages_armful_2l@icloud.com

Helpful details: what you found, the steps or a URL to reproduce it, and what an attacker could do with it. Please do
not access, change or delete other users' data while testing; a sign-in with your own test account is enough to show
most problems.

## Scope

In scope:

- The app at [istvan-panczel.github.io/d2r-esr-runeword-browser](https://istvan-panczel.github.io/d2r-esr-runeword-browser/)
  and the code in this repository.
- Its Supabase backend: sign-in, profiles, builds, favourites and shared loot filters, including the database rules in
  [`supabase/migrations/`](./supabase/migrations/).

Not in scope:

- The Eastern Sun Resurrected mod, its launcher, its website and its loot filter plugin. Report those to the mod's
  authors ([ESR on GitHub](https://github.com/CelestialRayOne/Eastern_Sun_Resurrected), or the ESR Discord linked
  from its website).
- Copies of this app hosted by other people, which run their own backends.
- The community tools linked from the home page.
- Values that are public by design: the Supabase project URLs and publishable keys in `.env.development` /
  `.env.production`, and the Cloudflare Web Analytics token in `index.html`. These are meant to be in the browser; the
  database rules are what protect the data.

## What to expect

This is a free hobby project run by one person, so replies are best effort. I aim to acknowledge a report within a week,
keep you updated while I look into it, and credit you in the fix or advisory if you want. Only the latest deployed
version is supported; fixes go into the next release.

## Your data

For questions about your own data (a copy, corrections or deleting your account), see the
[Privacy Policy](./PRIVACY_POLICY.md).
