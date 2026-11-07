---
title: Order of enhancements
kind: hub
summary: Which item upgrades can be undone, which are random, and a sensible order for applying them to an item you plan to keep.
tags: [crafting, enhancement]
aliases: [enhancement, upgrade order, checklist, cheat sheet, tinkering, legendary consumables, sanctify, branded]
knowFirst: [forging, socketing]
related: [dstoning-and-mapling, corruption-anointment, hell-survival, tinkering, weapon-mastery]
volatility: high
mentions:
  [
    Thawing Potion,
    Antidote Potion,
    Key,
    Astrogha's Petrified Heart,
    Tyrael's Eternal Feather,
    Lilith's Crystallized Tear,
    Lucion's Relic of Sanctification,
    Inarius' Everburning Halo,
    Weapon Mastery Token,
  ]
officialDocs:
  - label: Cube Recipes – Legendary Consumables
    href: 'docs:Eastern Sun Resurrected Cube Recipes.html#legendary'
  - label: Cube Recipes – Tinkering
    href: 'docs:Eastern Sun Resurrected Cube Recipes.html#tin'
sources: [official-cube, official-docs, esr-txt, esru-wiki]
---

ESR stacks many upgrades on one item. Some can be undone, some are random, and some lock the item for good, so the order matters.

| Enhancement                                   | Removable?             | Random or fixed?                | How to undo                                                                          |
| --------------------------------------------- | ---------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| Socket contents                               | Yes                    | Fixed                           | Key returns item and socketables                                                     |
| Added sockets                                 | No                     | Fixed                           | Count cannot change                                                                  |
| Forging                                       | Yes, except Wo Forging | Fixed                           | 3 Thawing Potions; an Aura Stone is lost unless you pay 2 gem 6 Packs + a Maple Leaf |
| [[mercenaries-oskills\|Merc Only Conversion]] | Yes                    | Fixed                           | 3 Antidote Potions                                                                   |
| [[weapon-mastery\|Weapon mastery]]            | Yes                    | Fixed                           | Class Dragon Stone form + 3 Thawing Potions; token and Anvil Stone lost              |
| D-stoning, gem melding                        | No                     | Fixed                           | Mapling only lowers the level penalty                                                |
| [[tinkering\|Tinkering]]                      | No                     | Fixed                           | Limited by the tinkering points shown on the item                                    |
| Corruption                                    | Status only            | Random; can brick               | Astrogha's Petrified Heart clears the status, keeps the bonus                        |
| Anointment                                    | No                     | Random                          | None                                                                                 |
| Legendary consumables                         | No                     | Fixed, except Sanctify (random) | None; the Halo gives back your item plus a Branded copy that can never be changed    |

### A sensible order

1. **Base and sockets first.** Socketing a white item rebuilds it, so do it before anything else ([[socketing]]).
2. **Reroll before you upgrade.** Rerolled uniques lose added sockets, and base-upgraded uniques cannot be rerolled at all. Level 92 unique jewels and quivers cannot be rerolled either.
3. **Base upgrade**, then **Forging**. Forging is safe to change later, but rerolls ignore forged items ([[forging]]).
4. **D-stone or gem meld, then Maple and repeat** on items you will keep ([[dstoning-and-mapling]]).
5. **:term[Tinkering]** with organs, until the item's tinkering points run out ([[tinkering]]).
6. **:term[Corruption]**, then **:term[Anointment]** ([[corruption-anointment]]). Corruption can turn the item into a random rare, so only corrupt what you can afford to lose.
7. **Legendary consumables last:** Tyrael's Eternal Feather (ethereal), Lilith's Crystallized Tear (Spell Mastery), :term[Sanctify] for jewels and, since 3.3, rings and amulets (one random bonus, once per item), and Inarius' Everburning Halo, which gives back your item plus a :term[Branded] copy that can never be changed again.

The recipe lists Tyrael's Eternal Feather for non-ethereal melee and thrown weapons, but an engine bug lets it work on an item that is already ethereal too, so check the item first or the feather is wasted. It does not work on missile weapons. <!-- verify: the 3.3 Specializations page makes ring and amulet sanctification the Jeweler perk Hallowed Accessories, but the cubemain Ring/Amulet Sanctification rows carry no perk condition; check in game without the perk -->

::recipes[legendary-consumables]

Every sanctification outcome, with how often each bonus comes up: [Sanctification outcomes](page:/game-data/enhance?tab=sanctification).

Most players only need steps 1 to 4 before Hell ([[hell-survival]]).
