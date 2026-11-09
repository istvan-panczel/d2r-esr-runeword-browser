---
title: Adding and removing sockets
kind: note
summary: A Key removes socketables safely; Socket Donuts add sockets. White items are rebuilt when socketed unless you use Secret Recipe 16 or 17.
tags: [crafting, sockets]
aliases: [sockets, socket, unsocket, socket donut, donut, remove runes]
knowFirst: [cube-basics]
related: [runewords-gemwords, secret-recipes]
mentions: [Socket Donut, Key]
officialDocs:
  - label: Cube Recipes – Socket
    href: 'docs:Eastern Sun Resurrected Cube Recipes.html#soc'
sources: [official-cube, official-docs, esr-txt, esru-wiki, esr-loader]
---

### Removing socketables

Cube any socketed item with a Key: you get the item back with empty sockets plus every gem, rune or jewel that was in it. Nothing is lost, but the recipe also identifies an unidentified item (not intended, and it cannot be fixed). That makes runewords and gem choices cheap to change ([[runewords-gemwords]]).

::recipes[unsocket]

### Adding sockets

The ingredients are a :term[Socket Donut] plus gems whose grade rises with the item's tier (normal, exceptional, elite) and its rarity:

::recipes[socket]

- **White or superior items:** one to six gems give that many sockets, but the item is recreated, so ethereal, superior and staff bonuses are lost. Secret Recipe 16 (weapons) and 17 (armor) add sockets and keep them ([[secret-recipes]]).
- **Magic, rare, crafted, set and unique items:** the recipe adds a fixed number of sockets that depends on the rarity and slot; the rarer the item, the fewer. The magic-item rows above that give one socket per gem, as on a white item, need the Archaeologist specialization perk [Power Overwhelming](page:/specializations?tree=archaeologist&perk=power-overwhelming) (3.3); since 3.3.03 the perk also turns off the fixed-socket recipe for magic weapons and armor, so with it you always pay one gem per socket.
- **Rings, amulets and charms:** Secret Recipes add a socket to rings and amulets and turn magic or unique small and grand charms into square and odd charms with a socket; the Veteran's Odd Charm takes Socket Donuts like other items ([[noobs-charm]]).

Lucion's Essence, a legendary consumable, adds a fixed number of sockets to magic, rare, crafted, set and unique gear without gems:

::recipes[lucion-essence]

### Limits

- An item never gets more sockets than its base allows, and an existing socket count cannot be changed.
- Items from Normal and Nightmare Act 1 may be too low level to reach the base's maximum. The [Bases](page:/bases) page shows socket limits by item level.
- Rerolling a unique removes sockets added before the reroll, so reroll first.
- Larzuk's socket reward refuses every charm (a launcher plugin, 3.3.03); the reward is not used up, so it can still go on an item he accepts.
- A socketed quiver no longer shows its quantity (a game bug); the arrows or bolts are still there.

Where Socket Donuts come from:

::source[Socket Donut]
