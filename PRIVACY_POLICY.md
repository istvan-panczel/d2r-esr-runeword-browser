# Privacy Policy

**Last updated:** 2026-11-10

This privacy policy explains what data I collect, why I collect it, and how you can control it. I've kept it short and written in plain language because I believe you shouldn't need a lawyer to understand how your data is handled.

## Who I Am

This app is a free, open-source community tool for a Diablo 2 Resurrected mod. The source code is publicly available on GitHub under the MIT license. I'm a single individual developer based in Hungary (EU) — there is no company or team behind it.

For any privacy-related questions or requests, contact me at: **mirages_armful_2l@icloud.com**

## What This Policy Covers

This policy covers only the app deployed at [istvan-panczel.github.io/d2r-esr-runeword-browser](https://istvan-panczel.github.io/d2r-esr-runeword-browser/) and the Supabase project I operate for it.

Because the project is MIT-licensed, other people can run their own copies (forks) of the app, with their own backends. This policy does not cover those copies, even if they link to this document. If you use a copy hosted somewhere else, its operator is responsible for your data there: send questions and deletion requests about it to that operator, not to me. I have no access to their databases and cannot change or delete data stored there.

## What Data I Collect

### When you create an account

- **If you sign in with Discord:** I receive your Discord user ID, username, and avatar URL from Discord's OAuth service. I do not receive your Discord password or access to your Discord messages.
- **If you sign in with email magic link:** I store the email address you provide.
- **Display name:** You choose a public display name during registration. It is shown to other users next to your builds and loot filters — together with your Discord avatar if you signed in with Discord.

### When you use the app

- **Builds:** The character builds you create (item/runeword selections, build name, description, character class).
- **Loot filters:** The loot filters you save (the filter file, its name and description, whether it is private, the versions it was made with, which filter it was copied from, and the short "what changed" note you may add when you update it).
- **Likes:** Which builds and loot filters you have liked.
- **Download counts:** How many times each saved loot filter was downloaded. This is a single number per filter; it does not record who downloaded it.
- **Favourites:** Which items (runewords, uniques, etc.) you have marked as favourites.
- **Timestamp of your privacy policy acceptance.**

### Anonymous traffic statistics

I use [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) to see how many people visit the app. It applies to every visitor, whether or not you have an account. It does not use cookies, does not store anything in your browser's localStorage, and does not fingerprint your device. It counts page views and records the referring site, country, browser and device type. I only see aggregated dashboards (for example "N page views from Germany this week"). I cannot see individual visitors, and these statistics are not linked to your account. Cloudflare's own handling of this data is described in [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).

### What I do NOT collect

- I do not use any analytics or tracking tools other than the cookie-less Cloudflare Web Analytics described above. There is no cross-site tracking.
- I do not serve advertisements.
- I do not collect your IP address, precise location, or individual device information for my own purposes. Cloudflare Web Analytics only gives me aggregated country, browser and device-type counts.
- I do not use cookies for tracking. The app only uses session tokens necessary for authentication.
- Loot filters you have not saved (drafts) stay in your browser's local storage and are never sent to me. Only the **Save** button sends a filter to the server.
- **Stash files and character saves** you open on the My Stash pages are read in your browser and kept in its local database (IndexedDB) so the pages remember them. They are never uploaded to me or anyone else.

## Why I Collect This Data

Account data serves one purpose: to let you save your builds and loot filters, share them with the community, and browse/like other players' builds and filters. The anonymous traffic statistics only tell me how much the app is used and which pages are popular. There is no other use.

| Data               | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| Email / Discord ID | To authenticate your account                   |
| Display name       | To show who created a build or loot filter     |
| Build data         | To save and share your builds                  |
| Loot filters       | To save your filters and share the public ones |
| Likes              | To rank popular builds and loot filters        |
| Download counts    | To rank loot filters by downloads              |
| Traffic statistics | To see how much the app is used, in aggregate  |

## What Is Publicly Visible

- Your **display name**, your **Discord avatar** (if you signed in with Discord), your **public builds** and your **public loot filters** (with their description, change note, like and download counts) are visible to all users (including unauthenticated visitors), who can also download those filters.
- Your **profile** (display name, avatar, and when the account was created and when you accepted this policy) can be listed by anyone through the app's public API, even if you have not shared anything yet. A Discord avatar address contains your Discord user ID.
- The app only shows avatar images hosted by Discord. Avatar addresses pointing anywhere else are not loaded.
- Loot filters you mark **Private** are visible only to you. Likes stay attached to a filter you make private and count again if you make it public again.
- Your **email address** is **never** visible to other users. It is stored in a separate, protected authentication system.
- Your **likes** and **favourites**: the app itself only shows totals (like counts on builds and loot filters, favourite counts on items). However, the underlying records — which builds and public loot filters you liked and which items you favourited, linked to your account ID — are technically readable by anyone through the app's public API.

## Where Your Data Is Stored

Your data is stored on **Supabase**, a backend-as-a-service platform, in managed PostgreSQL databases hosted in the **West EU (Ireland)** region (`eu-west-1`) — within the European Union (EU).

Supabase acts as a data processor on my behalf. Their privacy practices are documented at [supabase.com/privacy](https://supabase.com/privacy).

## Third-Party Services

I use the following third-party services that may process your data:

| Service    | Purpose                                      | Data shared                                                         |
| ---------- | -------------------------------------------- | ------------------------------------------------------------------- |
| Supabase   | Database, auth, API hosting                  | All account, build and loot filter data                             |
| Discord    | OAuth sign-in (if chosen)                    | Discord user ID, username, avatar                                   |
| Cloudflare | Anonymous traffic statistics (Web Analytics) | Page views, referrer, country, browser and device type (no cookies) |

I do not share your data with anyone else. I do not sell your data. I never will.

Like any website, the app is loaded from and fetches public files from a few hosts, which therefore see your IP address and browser details as part of the normal request (I receive none of this):

| Host                                                | Why your browser contacts it                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GitHub Pages (`istvan-panczel.github.io`)           | Serves the app itself                                                                                    |
| GitHub (`raw.githubusercontent.com`)                | The ESR version check (the mod's launcher metadata) and Sully's live loot filter (the loot filter pages) |
| The official ESR site (`easternsunresurrected.com`) | The item, runeword and unique tables the app reads                                                       |
| Discord's CDN (`cdn.discordapp.com`)                | Avatar images of players who signed in with Discord                                                      |

The app also links to external sites (the official ESR site, Discord and fan-made community tools) that are not operated by me and have their own privacy practices, which this policy does not cover.

## Your Rights

Under the General Data Protection Regulation (GDPR), you have the following rights:

### Right to access

You can request a copy of all data I hold about you. Contact me at the email above, or view your data directly in the app (your profile, your builds, your loot filters, your likes).

### Right to rectification

You can update your display name at any time in the app's settings, and rename, edit, make private or delete your loot filters in the loot filter editor.

### Right to erasure (right to be forgotten)

You can request deletion of your entire account and all associated data — your profile, all your builds, all your loot filters (public and private, with their change notes and download counts), all your likes, and your authentication record. Copies other players made of your public loot filters are theirs and stay; they keep only the "based on" label with your filter's name and your display name. Automatic in-app deletion is not yet available, so you can request erasure in either of these ways:

- **Open an issue** on the GitHub repository: [github.com/istvan-panczel/d2r-esr-runeword-browser/issues](https://github.com/istvan-panczel/d2r-esr-runeword-browser/issues/new), or
- **Email** me at mirages_armful_2l@icloud.com.

I will process your request and permanently remove your data. This action is irreversible.

### Right to data portability

You can request an export of your data in a machine-readable format (JSON). Contact me at the email above.

### Right to withdraw consent

You can request account deletion at any time (see "Right to erasure" above), which revokes all consent and deletes all your data.

### Right to object

If you have concerns about how your data is being processed, contact me at the email above.

## Data Retention

- Your data is kept for as long as your account exists.
- When you request account deletion, all associated data (profile, builds, loot filters, likes) is permanently deleted once I process the request.
- I do not keep backups of deleted account data.

## Children's Privacy

This app is not directed at children under the age of 16. I do not knowingly collect personal data from children under 16. If you believe a child under 16 has created an account, please contact me and I will delete it.

## Changes to This Policy

If I make changes to this privacy policy, I will update the "Last updated" date at the top. For significant changes, I will notify users through the app. The history of changes is available in the Git repository.

## Contact

For any questions, data requests (including account deletion), or concerns about this privacy policy:

**Email:** mirages_armful_2l@icloud.com

**GitHub:** Open an issue at [github.com/istvan-panczel/d2r-esr-runeword-browser/issues](https://github.com/istvan-panczel/d2r-esr-runeword-browser/issues/new)

You also have the right to lodge a complaint with the data protection authority in your country of residence or work (your supervisory authority under the GDPR).
