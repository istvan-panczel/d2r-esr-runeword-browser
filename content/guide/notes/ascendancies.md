---
title: Ascendancies
kind: link
summary: A subclass picked in its own character panel, unlocked by an Orb of Creation from five Hell superuniques, with five tiers of challenges.
tags: [endgame]
aliases: [ascendancy, ascendancy stone, orb of creation, subclass, primordial soulstone]
knowFirst: [endgame-roadmap]
related: [maps-keys-ascendancy, endgame-bosses, death-and-respec]
volatility: high
mentions: [Orb of Creation, Orb of Storms, Orb of Earth, Orb of Water, Orb of Wind, Orb of Fire, Primordial Soulstone]
officialDocs:
  - label: Ascendancies
    href: docs:ascendancies.htm#challenge
sources: [official-docs, esr-txt, esr-loader, patchnotes]
---

An :term[Ascendancy] is a subclass with its own skills and bonuses. Since 3.3.04 you pick it in a panel next to the specializations on the character sheet, not on a stone. Cube the orbs of five Hell superuniques into an Orb of Creation and use it to open the panel.

::recipes[ascendancy]

### Where the five orbs drop

Each orb drops from one superunique on Hell; the places below were checked in game. Since 3.3 the orbs and the Orb of Creation cannot go in the shared stash, so farm them with the character that will ascend.

**Orb of Storms:** Act 1, The Hole level 2, below the Black Marsh.

::source[Orb of Storms]

**Orb of Earth:** Act 2, Halls of the Dead level 2, below the Dry Hills.

::source[Orb of Earth]

**Orb of Water:** Act 3, Travincal, south-east of the Council.

::source[Orb of Water]

**Orb of Wind:** Act 5, Arreat Plateau, west of the Crystalline Passage entrance.

::source[Orb of Wind]

**Orb of Fire:** Act 5, Worldstone Chamber, north-west corner.

::source[Orb of Fire]

### The later tiers

A launcher plugin grants each tier when you finish its challenge, in any order and with no cube recipe (3.3.04), and credits every player in the boss's area. Tier 2: Nihlathak on Hell. Tier 3: all three Uber Tristram bosses within a minute, without dying. Tier 4: ten [Primordial Soulstones](<dropfinder:Primordial Soulstone>) from map bosses, absorbed and counted in the panel; their drop rule still reads the old stone's counter, so check in game whether they still stop at ten. <!-- verify: treasureclassex.txt "Primordial Soulstone" condition stat('ascendancy_tier_4_count_new'.accr)<10 = stat 919, the legacy_soulstone_stat of celestialrayone.ascendancies.toml; the panel counts soulstone_stat 1066 --> Tier 5: any tier 5 map boss ([[maps-keys-ascendancy]]).

The Lich King on players 8 now adds +10% to the tier 3 and 4 scaling bonuses, not +1 to all skills ([[endgame-bosses]]).

An old stone disappears when its character enters a game, and its tiers move to the panel. The bonuses are rebuilt every game and after a resurrect, so nothing needs re-equipping ([[death-and-respec]]). Renouncing clears the ascendancy, its tiers, the soulstones and the Lich King bonus; picking again takes a new Orb of Creation. The [Ascendancies](page:/ascendancies) page compares them and lists the orb locations and challenges.
