---
title: Avoid early disasters
kind: note
summary: The ESR traps that cost characters or items, from charms that do nothing to items you must never wear.
tags: [basics, early-game]
aliases: [traps, hp 1, life 1, crash, items disappearing]
knowFirst: [start-here]
related: [unique-charms, stockers, mercenaries-oskills, vessel-of-souls]
volatility: high
mentions: [Vessel of Souls, Noob's Odd Charm, Veteran's Odd Charm, Antidote Potion, Anvil Stone, Horadric Cube]
officialDocs:
  - label: Vessel of Souls
    href: docs:vessel_of_souls.htm
sources: [official-docs, official-cube, patchnotes, esr-txt, esru-wiki]
---

### Charms only work in the charm inventory

ESR adds a separate charm inventory, opened from a button on the inventory panel. Charms left in the normal inventory get a red tint and give no bonus. Only one of Noob's or Veteran's Odd Charm counts at a time; the other turns red. Unique charms are limited as well: you can carry only one of each of the big ones, such as Annihilus or the Hellfire Torch, and patch 3.2.11 fixed a bug that let you equip several in the charm inventory ([[unique-charms]]). <!-- verify: uniqueitems.txt gives 12 unique charms (Annihilus, Hellfire Torch, Gheed's Fortune, Eternal Hourglass, Rathma's Skull and others) each its own carry-one flag, so the files say one of each, not one in total; the other unique charms have no flag. Check in-game. -->

### Items that are not for you

- Gear changed by **Merc Only Conversion** shows a red "Merc Only Conversion" line and carries a huge hidden life drain (a -900 life regeneration stat; the original Eastern Sun used a Vitality penalty instead), so wearing it yourself empties your life to 1. Give it to your mercenary ([[mercenaries-oskills]]). Three Antidote Potions in the cube remove the conversion and return the Anvil Stone and gem.
- The :term[Vessel of Souls] is a mythical amulet you feed organs in the cube. It cannot be worn as an amulet; the official page says to finish its crafting and turn it into a weapon first (its old warning that wearing it sets your life to 1 has been gone from the page since 3.2.24) ([[vessel-of-souls]]).

### Cube and save safety

- Older guides warn that transmuting or dropping a cube holding more than 100 items crashes the game; keep it well below that. <!-- verify: not mentioned in the 3.2.12 files or patch notes; check in-game -->
- Back up your save folder now and then. Patch 3.2.11 fixed saves above 16 KB failing to load.
- If a reroll recipe does nothing, check whether the item has a :term[Forging]; most rerolls ignore forged items ([[cube-basics]]).

Keeping materials inside [[stockers]] also keeps the item count, and the save, small.
