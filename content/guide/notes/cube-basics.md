---
title: Cube basics
kind: hub
summary: How ESR uses the Horadric Cube, how to read the official recipe page, and the rules that make a recipe silently fail.
tags: [crafting, basics]
aliases: [cube, horadric cube, transmute, recipe does nothing, recipes]
knowFirst: [loot-triage]
related: [forging, socketing, secret-recipes, dragon-stones]
mentions: [Horadric Cube, Key, Thawing Potion, Scroll of Identify, Antidote Potion]
officialDocs:
  - label: Cube Recipes
    href: 'docs:Eastern Sun Resurrected Cube Recipes.html'
sources: [official-cube, patchnotes, esr-txt]
---

In ESR almost every upgrade is a cube recipe. The official Cube Recipes page is the full reference: sections of short rules followed by Input → Output tables. It is not a tutorial, so here is how to read it.

### Reading the page

- "Any …" means any item of that kind. "Torso" is body armor, "Armor" is every kind of armor.
- "ilvl = char level" and similar lines give the output's item level, which decides the affixes it can roll.
- Underlined materials in an output are handed back to you; removing a Forging, for example, returns its Anvil Stones.
- Keys, Scrolls of Identify, Antidote Potions and the like often act as switches that pick which variant of a recipe runs.

### Why a recipe does nothing

- **Forging:** most recipes that reroll the input ignore items with a Forging; remove it first ([[forging]]).
- **Level limits:** D-stoning stops once the item's level requirement penalty is too high ([[dstoning-and-mapling]]).
- **Order:** base-upgraded uniques cannot be rerolled (sets must be converted back first), and uniques lose added sockets when rerolled ([[enhancement-order]]). Level 92 unique jewels and quivers cannot be rerolled at all.
- **Branded** items cannot be changed by any recipe.
- **Too much in the cube:** older guides warn that more than 100 items can crash the game ([[avoid-disasters]]).

### Rerolling rings and amulets

- When several rings or amulets go in together, the last one you put in the cube decides the type: a ring, an Amazon ring and a Sorceress ring, in that order, give a new Sorceress ring.
- The new item's level comes from your character level; if it is below the level of the unique it rolled, you get a rare instead.
- A non-class unique ring or amulet needs a character level above 15, a class-specific one above 57.

### Faster cubing

- Since 3.2.11 the transmute hotkey (set it under Options > Controls) works with the cube closed, and holding it repeats.
- Material tabs in the stash upgrade with Shift + click and downgrade with Alt + click, no cube needed.

### Where to start

Socketing ([[socketing]]), Forging ([[forging]]), Dragon Stones ([[dragon-stones]]) and the numbered [[secret-recipes]] cover most of what a new character uses.
