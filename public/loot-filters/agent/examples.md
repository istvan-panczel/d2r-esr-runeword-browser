# Style presets

Ready-made looks (name colour, label background and border, sometimes a droplight, and most with a minimap icon); the example rules below use them. A rule's `"useStyle": "HighRune"` works only when the filter defines that style under `"styles"`: for every preset you use, copy its block into the filter's `"styles"` object under the same name (change the look freely). A missing one is the app's "There is no style named …" error. A rule's own `"icon"` replaces its style's, but no rule can remove it: a rule that wants no icon uses a copy of the style without one (the `NoIcon` blocks). Sounds and chat lines stay on the rules.

## HighRune

Red name on a white plate, thick red border and a red beam: the drops worth stopping for.

```json
{
  "HighRune": {
    "replaceName": "ÿc1{name}",
    "labelBackground": [255,255,255,255],
    "labelBorder": {"color":[240,0,0,255],"width":2},
    "icon": {"iconName":"diamond_red","iconSize":50},
    "droplight": {"color":[255,40,0]}
  }
}
```

## MidTierRune

Orange name on black with an orange border: good runes you still pick up.

```json
{
  "MidTierRune": {
    "replaceName": "ÿc8{name}",
    "labelBackground": [0,0,0,230],
    "labelBorder": {"color":[255,168,0,255],"width":1},
    "icon": {"iconName":"diamond_orange","iconSize":40}
  }
}
```

## LowRune

Orange name, no box: easy to spot, easy to ignore.

```json
{
  "LowRune": {
    "replaceName": "ÿc8{name}"
  }
}
```

## UniqueItem

Gold name on dark brown with an orange border.

```json
{
  "UniqueItem": {
    "replaceName": "ÿc4{name}",
    "labelBackground": [40,25,0,230],
    "labelBorder": {"color":[255,165,0,255],"width":1},
    "icon": {"iconName":"star_gold","iconSize":30}
  }
}
```

## SetItem

Green name on dark green with a green border.

```json
{
  "SetItem": {
    "replaceName": "ÿc2{name}",
    "labelBackground": [0,35,0,230],
    "labelBorder": {"color":[0,255,0,255],"width":1},
    "icon": {"iconName":"star_green","iconSize":30}
  }
}
```

## MythicalUnique

Purple name on white, thick purple border and a purple beam: the rarest drops in ESR.

```json
{
  "MythicalUnique": {
    "replaceName": "ÿc;{name}",
    "labelBackground": [255,255,255,255],
    "labelBorder": {"color":[174,0,255,255],"width":2},
    "icon": {"iconName":"star_purple","iconSize":50},
    "droplight": {"color":[174,0,255]}
  }
}
```

## RunewordBase

Grey plate with a white border: a white or grey base with the sockets you want.

```json
{
  "RunewordBase": {
    "labelBackground": [45,45,45,230],
    "labelBorder": {"color":[255,255,255,255],"width":1},
    "icon": {"iconName":"shield_white","iconSize":30}
  }
}
```

## GoodCharm

Dark green plate with a green border: a charm with a stat worth checking.

```json
{
  "GoodCharm": {
    "labelBackground": [0,40,20,230],
    "labelBorder": {"color":[0,200,80,255],"width":1},
    "icon": {"iconName":"square_emerald","iconSize":35}
  }
}
```

## GoodJewel

Yellow name on black with a teal border (Sully’s rare jewel look).

```json
{
  "GoodJewel": {
    "replaceName": "ÿc9{name}",
    "labelBackground": [0,0,0,255],
    "labelBorder": {"color":[0,200,200,255],"width":1},
    "icon": {"iconName":"hexagon_yellow","iconSize":27}
  }
}
```

## GoodJewellery

A thick light blue border: rings, amulets and class jewellery worth identifying.

```json
{
  "GoodJewellery": {
    "labelBorder": {"color":[0,160,255,255],"width":2},
    "icon": {"iconName":"ring_blue","iconSize":35}
  }
}
```

## UberItem

Purple name on black with a purple border (Sully’s Uber look): keys, organs, essences.

```json
{
  "UberItem": {
    "replaceName": "ÿc;{name}",
    "labelBackground": [0,0,0,200],
    "labelBorder": {"color":[165,55,253,255],"width":1},
    "icon": {"iconName":"key_purple","iconSize":35}
  }
}
```

## PerfectGem

A thin gold border, the game’s own name colour.

```json
{
  "PerfectGem": {
    "labelBorder": {"color":[200,150,0,255],"width":1},
    "icon": {"iconName":"gem_gold","iconSize":27}
  }
}
```

## CraftingReagent

Orange name with a thin gold border: body parts, crystals and other cube ingredients.

```json
{
  "CraftingReagent": {
    "replaceName": "ÿc8{name}",
    "labelBorder": {"color":[200,150,0,255],"width":1},
    "icon": {"iconName":"flame_orange","iconSize":27}
  }
}
```

## RareReagent

Black name on a gold plate (Sully’s GoldPlate): rare cube reagents and large gold piles.

```json
{
  "RareReagent": {
    "replaceName": "ÿc6{name}",
    "labelBackground": [200,150,0,255],
    "labelBorder": {"color":[0,0,0,255],"width":1},
    "icon": {"iconName":"coin_gold","iconSize":27}
  }
}
```

## CouponItem

Gold name with an orange border: Ancient Coupons you cube into uniques.

```json
{
  "CouponItem": {
    "replaceName": "ÿc4{name}",
    "labelBorder": {"color":[255,165,0,255],"width":1},
    "icon": {"iconName":"scroll_gold","iconSize":40}
  }
}
```

## MapItem

White name on black with a white border (Sully’s map look).

```json
{
  "MapItem": {
    "replaceName": "ÿc0{name}",
    "labelBackground": [0,0,0,255],
    "labelBorder": {"color":[255,255,255,255],"width":1},
    "icon": {"iconName":"map_white","iconSize":30}
  }
}
```

## ValuableDrop

Red name on white with a red border: anything rare and valuable that has no look of its own.

```json
{
  "ValuableDrop": {
    "replaceName": "ÿc1{name}",
    "labelBackground": [255,255,255,255],
    "labelBorder": {"color":[255,0,0,255],"width":1},
    "icon": {"iconName":"cross_red","iconSize":40}
  }
}
```

## MutedJunk

Grey name on a faint box: shown, but out of the way (the soft alternative to hiding).

```json
{
  "MutedJunk": {
    "replaceName": "ÿc5{name}",
    "labelBackground": [0,0,0,120]
  }
}
```

## MidTierRuneNoIcon

```json
{
  "MidTierRuneNoIcon": {
    "replaceName": "ÿc8{name}",
    "labelBackground": [0,0,0,230],
    "labelBorder": {"color":[255,168,0,255],"width":1}
  }
}
```

# Example rules

Complete rules in groups: conditions, a style preset from above, and on the valuable drops a bundled sound, a minimap icon and a chat line; hide rules have no looks (a hidden item shows nothing). They use real ESR codes and pass the app's checks: reuse and adapt them. Put the label rules first and the hide rules last; a hide rule hides wherever it stands, so this only keeps the filter readable.

## Runes

ESR keeps the classic runes as r51 (El) to r83 (Zod) and adds its own lines: kanji runes (r01 to r46), Null and the elemental runes (r84 to r97). An item code list matches any of its codes.

### Low runes: El to Dol

El (r51) to Dol (r64), kept visible but quiet: an orange name and nothing else.

```json
{
  "itemCodes": ["r51","r52","r53","r54","r55","r56","r57","r58","r59","r60","r61","r62","r63","r64"],
  "useStyle": "LowRune",
  "comment": "Low runes: El to Dol"
}
```

### Mid runes: Hel to Um

Hel (r65) to Um (r72) get a box and a border, still without a sound.

```json
{
  "itemCodes": ["r65","r66","r67","r68","r69","r70","r71","r72"],
  "useStyle": "MidTierRuneNoIcon",
  "comment": "Mid runes: Hel to Um"
}
```

### Mal, Ist and Gul runes

Mal (r73), Ist (r74) and Gul (r75): the mid-rune look plus a sound, an orange diamond on the minimap and a chat line.

```json
{
  "itemCodes": ["r73","r74","r75"],
  "chatMessage": "ÿc8Rune: ÿc0{name}",
  "sound": "mid.mp3",
  "useStyle": "MidTierRune",
  "comment": "Mal, Ist and Gul runes"
}
```

### High runes: Vex to Zod

Vex (r76) to Zod (r83) with everything: a white plate, a beam, the tink sound, a red diamond on the minimap and a chat line. The sound and icon files come with the .zip download.

```json
{
  "itemCodes": ["r76","r77","r78","r79","r80","r81","r82","r83"],
  "chatMessage": "ÿc1High rune: ÿc0{name}",
  "sound": "tink.mp3",
  "useStyle": "HighRune",
  "comment": "High runes: Vex to Zod"
}
```

### ESR kanji runes: I to Mo

The common part of ESR’s kanji rune line, I (r01) to Mo (r35), with the low-rune look.

```json
{
  "itemCodes": ["r01","r02","r03","r04","r05","r06","r07","r08","r09","r10","r11","r12","r13","r14","r15","r16","r17","r18","r19","r20","r21","r22","r23","r24","r25","r26","r27","r28","r29","r30","r31","r32","r33","r34","r35"],
  "useStyle": "LowRune",
  "comment": "ESR kanji runes: I to Mo"
}
```

### ESR kanji runes: No to Re

No (r36) to Re (r42), which Sully calls the gold runes: the mid-rune look with a sound and an icon.

```json
{
  "itemCodes": ["r36","r37","r38","r39","r40","r41","r42"],
  "chatMessage": "ÿc8ESR rune: ÿc0{name}",
  "sound": "mid.mp3",
  "useStyle": "MidTierRune",
  "comment": "ESR kanji runes: No to Re"
}
```

### ESR kanji runes: Su, He, Nu, Wo and Null

The top of the kanji line (r43 to r46) and the Null Rune (r50), treated like high runes.

```json
{
  "itemCodes": ["r43","r44","r45","r46","r50"],
  "chatMessage": "ÿc;ESR rune: ÿc0{name}",
  "sound": "tink.mp3",
  "useStyle": "HighRune",
  "comment": "ESR kanji runes: Su, He, Nu, Wo and Null"
}
```

### ESR elemental runes: Moon to God

Moon (r84) to God (r97), ESR’s highest runes, treated like high runes.

```json
{
  "itemCodes": ["r84","r85","r86","r87","r88","r89","r90","r91","r92","r93","r94","r95","r96","r97"],
  "chatMessage": "ÿc;ESR rune: ÿc0{name}",
  "sound": "tink.mp3",
  "useStyle": "HighRune",
  "comment": "ESR elemental runes: Moon to God"
}
```

### Ancient Decals for Mal to Zod

An Ancient Decal names the rune it makes (To -> Mal … Wo -> Zod, 23l to 33l); Sully highlights these like the runes.

```json
{
  "itemCodes": ["23l","24l","25l","26l","27l","28l","29l","30l","31l","32l","33l"],
  "chatMessage": "ÿc8Decal: ÿc0{name}",
  "sound": "mid.mp3",
  "icon": {"iconName":"cross_red","iconSize":30},
  "useStyle": "ValuableDrop",
  "comment": "Ancient Decals for Mal to Zod"
}
```

## Gems

ESR gems run Chipped, Flawed, normal, Flawless, Blemished, Perfect; each grade is an item type (gem0 to gem5).

### Perfect gems

One item type (gem5) covers every perfect gem, Amethyst to Obsidian; Perfect gems pay for most rerolls.

```json
{
  "itemTypes": ["gem5"],
  "useStyle": "PerfectGem",
  "comment": "Perfect gems"
}
```

### Blemished gems

ESR’s grade between Flawless and Perfect (gem4): rare rerolls, Pandemonium keys and the Vessel of Souls take it.

```json
{
  "itemTypes": ["gem4"],
  "useStyle": "PerfectGem",
  "comment": "Blemished gems"
}
```

### Hide chipped and flawed gems from character level 20

A character stat condition: the rule waits until your character is level 20 (Sully hides chipped gems from 20), and never hides in town. Skip it if you craft Aura Stones, which take a chipped gem.

```json
{
  "itemTypes": ["gem0","gem1"],
  "playerStats": [{"stat":"level","op":">=","value":20}],
  "excludeAreas": [1,40,75,103,109],
  "hide": true,
  "comment": "Hide chipped and flawed gems from character level 20"
}
```

## Uniques

Quality unique matches every unique item; narrow it with item types or unique ids.

### Unique weapons and armour

Every unique weapon and armour piece gets the unique look, the unique sound and a gold star on the minimap. Mythical bases are left out: the mythical rule gives them their own sound and chat line.

```json
{
  "excludeItemCodes": ["7wd","dd1","m01","m02","m03","m04","m05","m06","m07","m08","m09","m10","m11","m12","m13","m14","m15","m16","m17","m18","m20","m21","m22","m23","m24","m25","m26","m27","m28","m29","m30","m31","m32","m33","m34","m35","m36","m37","m38","m39","m40","m41","m42","m43","m44","m45","m46","m47","m48","m49","m50","m51","m52","m53","m54","m55","m56","m57","m58","m59","m60","m61"],
  "itemTypes": ["weap","armo"],
  "quality": "unique",
  "sound": "unique.mp3",
  "useStyle": "UniqueItem",
  "comment": "Unique weapons and armour"
}
```

### Unique rings and amulets

Ring and amulet types include the class rings and amulets, since an item type matches its children. The mythical ring and amulets are left out for the mythical rule.

```json
{
  "excludeItemCodes": ["mrn","mam","au9"],
  "itemTypes": ["ring","amul"],
  "quality": "unique",
  "chatMessage": "ÿc4Unique jewellery: {name}",
  "sound": "other.mp3",
  "icon": {"iconName":"crown_gold","iconSize":40},
  "useStyle": "UniqueItem",
  "comment": "Unique rings and amulets"
}
```

### Unique charms and jewels

Unique charms and jewels are rare and often worth a lot, so they get the valuable look and the tink.

```json
{
  "itemTypes": ["char","jewl"],
  "quality": "unique",
  "chatMessage": "ÿc4Unique: {name}",
  "sound": "tink.mp3",
  "icon": {"iconName":"cross_red","iconSize":35},
  "useStyle": "ValuableDrop",
  "comment": "Unique charms and jewels"
}
```

### One unique by name: The Oculus

Uniques and sets are matched by row id (the picker finds them by name). ESR has two rows for many uniques, one that drops and one cubed from an Ancient Coupon, so both are listed; quality unique keeps set items with the same numbers out.

```json
{
  "quality": "unique",
  "uniqueOrSetIds": [418,973],
  "chatMessage": "ÿc4The Oculus dropped",
  "sound": "unique.mp3",
  "useStyle": "UniqueItem",
  "comment": "One unique by name: The Oculus"
}
```

## Sets

Two rules can match the same item: the second adds its chat line and keeps the first one’s label.

### Set items

Every set item gets the set look, the unique sound and a green star on the minimap.

```json
{
  "quality": "set",
  "sound": "unique.mp3",
  "useStyle": "SetItem",
  "comment": "Set items"
}
```

### A chat line for elite set items

Base tier elite narrows it to sets on elite bases. Placed after the set rule, it adds the chat line and keeps that label.

```json
{
  "quality": "set",
  "baseTier": "elite",
  "chatMessage": "ÿc2Elite set: {name}",
  "comment": "A chat line for elite set items"
}
```

## Mythical uniques

Mythical items have their own bases (Mythical Marksman Bow…), so they are matched by item codes.

### Mythical uniques

The mythical bases that drop (weapons, armour, the mythical ring and amulets) at quality unique: ESR’s rarest drops.

```json
{
  "itemCodes": ["m01","m02","m03","m04","m05","m06","m07","m08","m09","m10","m11","m12","m13","m14","m15","m16","m17","m18","dd1","m20","m29","m30","m31","m32","m33","m34","m35","m36","m37","m38","m39","m60","m61","mrn","mam","au9"],
  "quality": "unique",
  "chatMessage": "ÿc;Mythical unique: ÿc4{name}",
  "sound": "mythical.mp3",
  "useStyle": "MythicalUnique",
  "comment": "Mythical uniques"
}
```

### White and grey mythical bases

Mythical bases have no normal/exceptional/elite tier (a base tier condition never matches them), so they are listed by code.

```json
{
  "itemCodes": ["m01","m02","m03","m04","m05","m06","m07","m08","m09","m10","m11","m12","m13","m14","m15","m16","m17","m18","dd1","m20","m29","m30","m31","m32","m33","m34","m35","m36","m37","m38","m39","m60","m61"],
  "quality": ["normal","superior"],
  "useStyle": "RunewordBase",
  "comment": "White and grey mythical bases"
}
```

## Coupons

Ancient Coupons cube into uniques; their item types split them by tier (cpn1 to cpn3).

### Elite coupons

Every coupon for an elite unique (item type cpn3), with a sound, a gold scroll icon and a chat line.

```json
{
  "itemTypes": ["cpn3"],
  "chatMessage": "ÿc4Elite coupon: ÿc0{name}",
  "sound": "other.mp3",
  "useStyle": "CouponItem",
  "comment": "Elite coupons"
}
```

### Exceptional coupons

Coupons for exceptional uniques (cpn2): the coupon look and a smaller icon.

```json
{
  "itemTypes": ["cpn2"],
  "icon": {"iconName":"scroll_gold","iconSize":30},
  "useStyle": "CouponItem",
  "comment": "Exceptional coupons"
}
```

### Ancient Coupon (Wild Card)

The Wild Card (99j) is a shortcut in many recipes, Blemished and Perfect gems among them.

```json
{
  "itemCodes": ["99j"],
  "chatMessage": "ÿc1Wild Card coupon",
  "sound": "tink.mp3",
  "icon": {"iconName":"scroll_gold","iconSize":40},
  "useStyle": "ValuableDrop",
  "comment": "Ancient Coupon (Wild Card)"
}
```

## Runeword bases

White (normal) and grey (superior) items take runewords. Sockets counts the sockets an item has, Max sockets the most its base can get.

### Show the socket count on white and grey gear

A name tag only: {sockets} writes the item’s sockets after its name. It comes first so the base rules below, which set their own suffix, win where both match.

```json
{
  "itemTypes": ["weap","armo"],
  "quality": ["normal","superior"],
  "sockets": {"min":2},
  "nameSuffix": " ÿc5[{sockets}]",
  "comment": "Show the socket count on white and grey gear"
}
```

### White and grey 4-socket swords for runewords

Normal and superior items both take runewords. Sockets counts the sockets the item has now; use Max sockets instead for bases you socket yourself.

```json
{
  "itemTypes": ["swor"],
  "quality": ["normal","superior"],
  "sockets": 4,
  "nameSuffix": " [4 sockets]",
  "useStyle": "RunewordBase",
  "comment": "White and grey 4-socket swords for runewords"
}
```

### Elite body armour with 3 or 4 sockets

A range (3 to 4 sockets) on one base tier: the usual bases for armour runewords.

```json
{
  "itemTypes": ["tors"],
  "quality": ["normal","superior"],
  "baseTier": "elite",
  "sockets": {"min":3,"max":4},
  "useStyle": "RunewordBase",
  "comment": "Elite body armour with 3 or 4 sockets"
}
```

### Ethereal elite polearms and spears with 4 or more sockets

Ethereal plus elite plus sockets: the classic mercenary weapon bases, with a socketed shield icon and a chat line that names the sockets.

```json
{
  "itemTypes": ["pole","spea"],
  "quality": ["normal","superior"],
  "baseTier": "elite",
  "sockets": {"min":4},
  "isEthereal": true,
  "chatMessage": "ÿc5Ethereal base: ÿc0{name} ({sockets} sockets)",
  "sound": "other.mp3",
  "useStyle": "RunewordBase",
  "comment": "Ethereal elite polearms and spears with 4 or more sockets"
}
```

### Paladin shields with 4 sockets

Auric shields (item type ashd) with exactly 4 sockets, the base of most shield runewords for Paladins.

```json
{
  "itemTypes": ["ashd"],
  "quality": ["normal","superior"],
  "sockets": 4,
  "useStyle": "RunewordBase",
  "comment": "Paladin shields with 4 sockets"
}
```

### Superior elite bases with no sockets that can take 4 or more

Max sockets is what the base can get, not what it has: these are bases to socket yourself. {maxSockets} shows the most.

```json
{
  "itemTypes": ["weap","armo"],
  "quality": "superior",
  "baseTier": "elite",
  "sockets": 0,
  "maxSockets": {"min":4},
  "nameSuffix": " ÿc5[max {maxSockets}]",
  "comment": "Superior elite bases with no sockets that can take 4 or more"
}
```

### Superior bases with +All Skills

A stat check on a white base: superior items can roll +All Skills in ESR. {stat:127} writes the amount in the name.

```json
{
  "itemTypes": ["weap","armo"],
  "quality": "superior",
  "itemStats": [{"stat":"item_allskills","op":">=","value":1}],
  "nameSuffix": " ÿc1[+{stat:127} skills]",
  "chatMessage": "ÿc4+All Skills base: ÿc0{name}",
  "sound": "other.mp3",
  "useStyle": "ValuableDrop",
  "comment": "Superior bases with +All Skills"
}
```

## Charms and jewels

Stat checks: “all of” needs every check, “any of” needs one. Small, large and grand charms are the types scha, mcha and lcha.

### Small charms with Magic Find or Faster Hit Recovery

“Item stats, any of” needs only one of its checks, so either stat is enough. Compare the all-resistances example below: there every stat must be on the item.

```json
{
  "itemTypes": ["scha"],
  "itemStatsAnyOf": [{"stat":"item_magicbonus","op":">=","value":5},{"stat":"item_fastergethitrate","op":">=","value":5}],
  "useStyle": "GoodCharm",
  "comment": "Small charms with Magic Find or Faster Hit Recovery"
}
```

### Small charms with 5 or more to all resistances

“Item stats, all of” needs every check: all four resistances at 5 or more, which only an all-resistances charm has.

```json
{
  "itemTypes": ["scha"],
  "itemStats": [{"stat":"fireresist","op":">=","value":5},{"stat":"lightresist","op":">=","value":5},{"stat":"coldresist","op":">=","value":5},{"stat":"poisonresist","op":">=","value":5}],
  "useStyle": "GoodCharm",
  "comment": "Small charms with 5 or more to all resistances"
}
```

### Grand charms with +1 to a skill tab

One check per class skill tab under “any of” (24 tabs, param class × 8 + tab): any tab is enough.

```json
{
  "itemTypes": ["lcha"],
  "itemStatsAnyOf": [{"stat":"item_addskill_tab","param":0,"op":">=","value":1},{"stat":"item_addskill_tab","param":1,"op":">=","value":1},{"stat":"item_addskill_tab","param":2,"op":">=","value":1},{"stat":"item_addskill_tab","param":8,"op":">=","value":1},{"stat":"item_addskill_tab","param":9,"op":">=","value":1},{"stat":"item_addskill_tab","param":10,"op":">=","value":1},{"stat":"item_addskill_tab","param":16,"op":">=","value":1},{"stat":"item_addskill_tab","param":17,"op":">=","value":1},{"stat":"item_addskill_tab","param":18,"op":">=","value":1},{"stat":"item_addskill_tab","param":24,"op":">=","value":1},{"stat":"item_addskill_tab","param":25,"op":">=","value":1},{"stat":"item_addskill_tab","param":26,"op":">=","value":1},{"stat":"item_addskill_tab","param":32,"op":">=","value":1},{"stat":"item_addskill_tab","param":33,"op":">=","value":1},{"stat":"item_addskill_tab","param":34,"op":">=","value":1},{"stat":"item_addskill_tab","param":40,"op":">=","value":1},{"stat":"item_addskill_tab","param":41,"op":">=","value":1},{"stat":"item_addskill_tab","param":42,"op":">=","value":1},{"stat":"item_addskill_tab","param":48,"op":">=","value":1},{"stat":"item_addskill_tab","param":49,"op":">=","value":1},{"stat":"item_addskill_tab","param":50,"op":">=","value":1},{"stat":"item_addskill_tab","param":56,"op":">=","value":1},{"stat":"item_addskill_tab","param":57,"op":">=","value":1},{"stat":"item_addskill_tab","param":58,"op":">=","value":1}],
  "chatMessage": "ÿc3Skiller: {name}",
  "sound": "other.mp3",
  "useStyle": "GoodCharm",
  "comment": "Grand charms with +1 to a skill tab"
}
```

### Rare jewels

Both jewel codes (jew and the Mythical Jewel mjw) at quality rare, Sully’s rare jewel look.

```json
{
  "itemCodes": ["jew","mjw"],
  "quality": "rare",
  "chatMessage": "ÿc9Rare jewel",
  "sound": "other.mp3",
  "useStyle": "GoodJewel",
  "comment": "Rare jewels"
}
```

## Class items and jewellery

Skill tab stats carry a param per tab (class × 8 + tab), so “+3 to any tab” lists one check per tab under “any of”.

### Rings and amulets with Faster Cast Rate and Magic Find

“Item stats, all of” needs every check, so only jewellery with both stats matches; the two item types in one list mean either (OR).

```json
{
  "itemTypes": ["ring","amul"],
  "itemStats": [{"stat":"item_fastercastrate","op":">=","value":10},{"stat":"item_magicbonus","op":">=","value":10}],
  "chatMessage": "FCR + MF: {name}",
  "useStyle": "GoodJewellery",
  "comment": "Rings and amulets with Faster Cast Rate and Magic Find"
}
```

### Rare class rings and amulets

ESR’s class jewellery (Amazonian Loop … Warlock’s Pendant) by item code, at quality rare.

```json
{
  "itemCodes": ["zrn","srn","nrn","prn","brg","drn","arn","wrn","zam","sam","nam","pam","bam","dam","aam","wam"],
  "quality": "rare",
  "chatMessage": "ÿc9Class jewellery: {name}",
  "sound": "other.mp3",
  "useStyle": "GoodJewellery",
  "comment": "Rare class rings and amulets"
}
```

### Class items with +3 to a skill tab

Class-specific items (type clas) minus class rings and amulets (Exclude item types), magic or rare, with +3 to any skill tab: one check per tab under “any of”.

```json
{
  "itemTypes": ["clas"],
  "excludeItemTypes": ["ring","amul"],
  "quality": ["magic","rare"],
  "itemStatsAnyOf": [{"stat":"item_addskill_tab","param":0,"op":">=","value":3},{"stat":"item_addskill_tab","param":1,"op":">=","value":3},{"stat":"item_addskill_tab","param":2,"op":">=","value":3},{"stat":"item_addskill_tab","param":8,"op":">=","value":3},{"stat":"item_addskill_tab","param":9,"op":">=","value":3},{"stat":"item_addskill_tab","param":10,"op":">=","value":3},{"stat":"item_addskill_tab","param":16,"op":">=","value":3},{"stat":"item_addskill_tab","param":17,"op":">=","value":3},{"stat":"item_addskill_tab","param":18,"op":">=","value":3},{"stat":"item_addskill_tab","param":24,"op":">=","value":3},{"stat":"item_addskill_tab","param":25,"op":">=","value":3},{"stat":"item_addskill_tab","param":26,"op":">=","value":3},{"stat":"item_addskill_tab","param":32,"op":">=","value":3},{"stat":"item_addskill_tab","param":33,"op":">=","value":3},{"stat":"item_addskill_tab","param":34,"op":">=","value":3},{"stat":"item_addskill_tab","param":40,"op":">=","value":3},{"stat":"item_addskill_tab","param":41,"op":">=","value":3},{"stat":"item_addskill_tab","param":42,"op":">=","value":3},{"stat":"item_addskill_tab","param":48,"op":">=","value":3},{"stat":"item_addskill_tab","param":49,"op":">=","value":3},{"stat":"item_addskill_tab","param":50,"op":">=","value":3},{"stat":"item_addskill_tab","param":56,"op":">=","value":3},{"stat":"item_addskill_tab","param":57,"op":">=","value":3},{"stat":"item_addskill_tab","param":58,"op":">=","value":3}],
  "chatMessage": "ÿc4+3 skill tab: {name}",
  "sound": "other.mp3",
  "useStyle": "ValuableDrop",
  "comment": "Class items with +3 to a skill tab"
}
```

## Keys, organs and endgame items

Uber keys and organs, respec essences, legendary materials, the Ascendancy items, Weapon Mastery Tokens and the pieces of the Eternal Hourglass.

### Pandemonium keys

The Keys of Terror, Hate and Destruction (pk1 to pk3) with Sully’s Uber look and the gong.

```json
{
  "itemCodes": ["pk1","pk2","pk3"],
  "chatMessage": "ÿc;Key: ÿc0{name}",
  "sound": "gong.mp3",
  "useStyle": "UberItem",
  "comment": "Pandemonium keys"
}
```

### Uber organs

Diablo’s Horn, Baal’s Eye and Mephisto’s Brain in their plain, Enhanced and Demonic forms.

```json
{
  "itemCodes": ["dhn","bey","mbr","ht1","ht2","ht3","um1","um2","um3"],
  "chatMessage": "ÿc;Organ: ÿc0{name}",
  "sound": "gong.mp3",
  "icon": {"iconName":"skull_purple","iconSize":35},
  "useStyle": "UberItem",
  "comment": "Uber organs"
}
```

### Essences and the Token of Absolution

The four essences and the token they make, the way to respec.

```json
{
  "itemCodes": ["tes","ceh","bet","fed","toa"],
  "chatMessage": "ÿc;Respec: ÿc0{name}",
  "sound": "gong.mp3",
  "icon": {"iconName":"skull_purple","iconSize":35},
  "useStyle": "UberItem",
  "comment": "Essences and the Token of Absolution"
}
```

### Legendary materials

Lilith’s Crystallized Tear, Tyrael’s Eternal Feather, Lucion’s Essence and Relic, Astrogha’s Petrified Heart, Inarius’ Everburning Halo.

```json
{
  "itemCodes": ["um8","um9","u17","u18","u20","u40"],
  "chatMessage": "ÿc8Legendary material: ÿc0{name}",
  "sound": "tink.mp3",
  "icon": {"iconName":"cross_red","iconSize":35},
  "useStyle": "ValuableDrop",
  "comment": "Legendary materials"
}
```

### Ascendancy orbs and soulstones

The five elemental orbs, the Orb of Creation that unlocks the ascendancy panel and the Primordial Soulstone.

```json
{
  "itemCodes": ["u11","u12","u13","u14","u15","u16","u19"],
  "chatMessage": "ÿc8Ascendancy: ÿc0{name}",
  "sound": "tink.mp3",
  "useStyle": "ValuableDrop",
  "comment": "Ascendancy orbs and soulstones"
}
```

### Ancient Scrolls

The fifty Ancient Scrolls (01b to 50b) on a gold plate with the gong.

```json
{
  "itemCodes": ["01b","02b","03b","04b","05b","06b","07b","08b","09b","10b","11b","12b","13b","14b","15b","16b","17b","18b","19b","20b","21b","22b","23b","24b","25b","26b","27b","28b","29b","30b","31b","32b","33b","34b","35b","36b","37b","38b","39b","40b","41b","42b","43b","44b","45b","46b","47b","48b","49b","50b"],
  "chatMessage": "ÿc4Ancient Scroll",
  "sound": "gong.mp3",
  "useStyle": "RareReagent",
  "comment": "Ancient Scrolls"
}
```

### Weapon Mastery Tokens

The token (u23) Corrupted Zakarum in Nightmare and Hell and the Endgame Map bosses drop: cubed with a class weapon it awakens, and the awakened token gives that weapon its mastery. The awakened tokens are made in the cube, so the rule leaves them out.

```json
{
  "itemCodes": ["u23"],
  "chatMessage": "ÿc8Weapon Mastery Token",
  "sound": "tink.mp3",
  "useStyle": "ValuableDrop",
  "comment": "Weapon Mastery Tokens"
}
```

### Broken hourglass and its shards

The Eternal Ancients of their tier 5 map drop the Broken hourglass (um6) and two shards (um4, um5); all three cube into the Eternal Hourglass of the Timeless Sands, a unique charm, so none may be left behind.

```json
{
  "itemCodes": ["um4","um5","um6"],
  "chatMessage": "ÿc4Hourglass piece: ÿc0{name}",
  "sound": "tink.mp3",
  "icon": {"iconName":"cross_red","iconSize":35},
  "useStyle": "ValuableDrop",
  "comment": "Broken hourglass and its shards"
}
```

## Crafting reagents

Cube ingredients from common body parts to rare reagents.

### Body parts

Hearts, brains, eyes and the other monster parts the cube recipes take.

```json
{
  "itemCodes": ["hrt","brz","jaw","eyz","hrn","tal","flg","fng","qll","sol","scz","spe"],
  "useStyle": "CraftingReagent",
  "comment": "Body parts"
}
```

### Rune crystals

The twelve crystals (Frozen Soul … Tainted Tourmaline) in their chipped, flawed and normal grades.

```json
{
  "itemCodes": ["xr0","xr1","xr2","xr3","xr4","xr5","xr6","xr7","xr8","xr9","xrx","xry","xl0","xl1","xl2","xl3","xl4","xl5","xl6","xl7","xl8","xl9","xlx","xly","xt0","xt1","xt2","xt3","xt4","xt5","xt6","xt7","xt8","xt9","xtx","xty"],
  "useStyle": "CraftingReagent",
  "comment": "Rune crystals"
}
```

### Socket Donuts, Worldstone Shards, Relics of Knowledge, Ancient Decipherers

Reagents you use often: the gold plate and the mid sound.

```json
{
  "itemCodes": ["sdo","wss","rel","ddd"],
  "chatMessage": "ÿc1Reagent: ÿc0{name}",
  "sound": "mid.mp3",
  "useStyle": "RareReagent",
  "comment": "Socket Donuts, Worldstone Shards, Relics of Knowledge, Ancient Decipherers"
}
```

### Rare reagents

Maple Leaf, Anvil Stone, Elixir, Cookbook and the Orb of Anointment: the gold plate, the gong and an icon.

```json
{
  "itemCodes": ["map","qqq","elx","yyy","um7"],
  "chatMessage": "ÿc1Rare reagent: ÿc4{name}",
  "sound": "gong.mp3",
  "useStyle": "RareReagent",
  "comment": "Rare reagents"
}
```

### Aura Stones

The eight Aura Stones (an3 to an9, a10), which forge an amulet with an aura in the cube.

```json
{
  "itemCodes": ["an3","an4","an5","an6","an7","an8","an9","a10"],
  "chatMessage": "ÿc8Aura Stone: ÿc0{name}",
  "sound": "tink.mp3",
  "useStyle": "ValuableDrop",
  "comment": "Aura Stones"
}
```

### Unique Stones

Unique Stones (nor, exc, eli: an0 to an2) come out of the cube from an Ancient’s Gift (a Baal and Diablo drop); one cubed with a white, grey or low quality base of its tier and no sockets makes a unique of that type. They never lie on the ground, so the rule only marks them in your inventory and stash: a look, no sound (the style’s minimap icon never shows, as it marks items on the ground).

```json
{
  "itemCodes": ["an0","an1","an2"],
  "useStyle": "ValuableDrop",
  "comment": "Unique Stones"
}
```

## Maps

Endgame maps z01 to z20 by tier, and The Hidden Vault.

### Tier 1 maps

z01 to z04 with the map look and icon, no sound.

```json
{
  "itemCodes": ["z01","z02","z03","z04"],
  "useStyle": "MapItem",
  "comment": "Tier 1 maps"
}
```

### Tier 2 to 4 maps

z05 to z16 with the map sound and a chat line.

```json
{
  "itemCodes": ["z05","z06","z07","z08","z09","z10","z11","z12","z13","z14","z15","z16"],
  "chatMessage": "Map: ÿc0{name}",
  "sound": "map.mp3",
  "useStyle": "MapItem",
  "comment": "Tier 2 to 4 maps"
}
```

### Tier 5 maps and The Hidden Vault

z17 to z20 and z99 with the tier 5 sound and a larger icon.

```json
{
  "itemCodes": ["z17","z18","z19","z20","z99"],
  "chatMessage": "ÿc4Tier 5 map: ÿc0{name}",
  "sound": "t5_map.mp3",
  "icon": {"iconName":"map_white","iconSize":40},
  "useStyle": "MapItem",
  "comment": "Tier 5 maps and The Hidden Vault"
}
```

## Gold and potions

Character stats: “level” is your character level, so a rule can wait until small gold and weak potions stop mattering; the levels are the ones Sully’s filter uses. Town areas are left out so nothing is hidden there.

### Gold piles of 100,000 or more

Stat 14 (gold) is the size of the pile. The $$ marks are name parts of the rule, so the amount stays visible.

```json
{
  "itemCodes": ["gld"],
  "itemStats": [{"stat":"gold","op":">=","value":100000}],
  "namePrefix": "ÿc2$$ ",
  "nameSuffix": " ÿc2$$",
  "chatMessage": "ÿc9Large gold pile",
  "sound": "other.mp3",
  "icon": {"iconName":"coin_gold","iconSize":30},
  "comment": "Gold piles of 100,000 or more"
}
```

### Ore and Fake Notes

Both sell for gold, so Sully gives them the gold pile look: a gold plate between $$ marks. An Ore can also be smashed with Secret Recipe 25 for a chance at a crystal (a failed smash leaves Ore Shards, which sell too); Fake Notes drop in the Fake Note Factory endgame zone and from Nihlathak’s clones.

```json
{
  "itemCodes": ["ore","fkn"],
  "namePrefix": "ÿc2$$ ",
  "nameSuffix": " ÿc2$$",
  "useStyle": "RareReagent",
  "comment": "Ore and Fake Notes"
}
```

### Hide gold piles under 100 from character level 20

Sully’s first gold step: piles under 100 once your character is level 20, outside town.

```json
{
  "itemCodes": ["gld"],
  "itemStats": [{"stat":"gold","op":"<","value":100}],
  "playerStats": [{"stat":"level","op":">=","value":20}],
  "excludeAreas": [1,40,75,103,109],
  "hide": true,
  "comment": "Hide gold piles under 100 from character level 20"
}
```

### Hide gold piles under 500 from character level 60

Sully’s next step, outside town. He goes on with piles under 750 from level 80 and under 2,000 from level 90: copy the rule and raise both numbers for those.

```json
{
  "itemCodes": ["gld"],
  "itemStats": [{"stat":"gold","op":"<","value":500}],
  "playerStats": [{"stat":"level","op":">=","value":60}],
  "excludeAreas": [1,40,75,103,109],
  "hide": true,
  "comment": "Hide gold piles under 500 from character level 60"
}
```

### Hide minor healing and mana potions from character level 12

The smallest potions (hp1, mp1) once your character is level 12, outside town, as in Sully’s filter.

```json
{
  "itemCodes": ["hp1","mp1"],
  "playerStats": [{"stat":"level","op":">=","value":12}],
  "excludeAreas": [1,40,75,103,109],
  "hide": true,
  "comment": "Hide minor healing and mana potions from character level 12"
}
```

### Hide light healing and mana potions from character level 20

The next size (hp2, mp2) from character level 20, outside town.

```json
{
  "itemCodes": ["hp2","mp2"],
  "playerStats": [{"stat":"level","op":">=","value":20}],
  "excludeAreas": [1,40,75,103,109],
  "hide": true,
  "comment": "Hide light healing and mana potions from character level 20"
}
```

### Hide healing and mana potions (hp3, mp3) from character level 40

The third size from character level 40, outside town. Sully hides greater and super potions (hp4, hp5, mp4, mp5) from 40 as well; add their codes if you drink rejuvenation potions only.

```json
{
  "itemCodes": ["hp3","mp3"],
  "playerStats": [{"stat":"level","op":">=","value":40}],
  "excludeAreas": [1,40,75,103,109],
  "hide": true,
  "comment": "Hide healing and mana potions (hp3, mp3) from character level 40"
}
```

### Hide stamina, antidote and thawing potions

Exclude areas keeps the town areas out, so you still see the ones you drop there.

```json
{
  "itemCodes": ["vps","yps","wms"],
  "excludeAreas": [1,40,75,103,109],
  "hide": true,
  "comment": "Hide stamina, antidote and thawing potions"
}
```

## Hide junk

A hidden item loses its label for good, whatever rule comes before or after, so keep hide rules narrow and give them exceptions. Try them in the Test tab.

### Hide cracked, damaged and crude gear from character level 10

A narrow hide rule: one quality (inferior) on weapons and armour, from character level 10 and outside town, as in Sully’s filter. A hidden item loses its label for good, so keep hide rules this specific.

```json
{
  "itemTypes": ["weap","armo"],
  "quality": "inferior",
  "playerStats": [{"stat":"level","op":">=","value":10}],
  "excludeAreas": [1,40,75,103,109],
  "hide": true,
  "comment": "Hide cracked, damaged and crude gear from character level 10"
}
```

### Hide magic and rare weapons from character level 20, except useful ones

A hide rule with exceptions: the stats under “Except items with…” are written as < 1 checks, and every check must hold to hide, so a weapon with +All Skills, +class skills, +a skill tab, Faster Cast Rate or Increased Attack Speed keeps its label. Class skills and skill tabs get one check per class and tab, since a check without param reads only the first; +skills to one skill (oskills) are not kept. It waits for character level 20 (Sully hides magic gear from 20) and leaves the towns out; class weapons, quest items and mythical bases are excluded.

```json
{
  "excludeItemCodes": ["7wd","dd1","m01","m02","m03","m04","m05","m06","m07","m08","m09","m10","m11","m12","m13","m14","m15","m16","m17","m18","m20","m21","m22","m23","m24","m25","m26","m27","m28","m29","m30","m31","m32","m33","m34","m35","m36","m37","m38","m39","m40","m41","m42","m43","m44","m45","m46","m47","m48","m49","m50","m51","m52","m53","m54","m55","m56","m57","m58","m59","m60","m61","d33","g33","hdm","hfh","hst","leg","msf","qf1","qf2"],
  "itemTypes": ["weap"],
  "excludeItemTypes": ["clas"],
  "quality": ["magic","rare"],
  "isIdentified": true,
  "itemStats": [{"stat":"item_allskills","op":"<","value":1},{"stat":"item_fastercastrate","op":"<","value":1},{"stat":"item_fasterattackrate","op":"<","value":1},{"stat":"item_addclassskills","param":0,"op":"<","value":1},{"stat":"item_addclassskills","param":1,"op":"<","value":1},{"stat":"item_addclassskills","param":2,"op":"<","value":1},{"stat":"item_addclassskills","param":3,"op":"<","value":1},{"stat":"item_addclassskills","param":4,"op":"<","value":1},{"stat":"item_addclassskills","param":5,"op":"<","value":1},{"stat":"item_addclassskills","param":6,"op":"<","value":1},{"stat":"item_addclassskills","param":7,"op":"<","value":1},{"stat":"item_addskill_tab","param":0,"op":"<","value":1},{"stat":"item_addskill_tab","param":1,"op":"<","value":1},{"stat":"item_addskill_tab","param":2,"op":"<","value":1},{"stat":"item_addskill_tab","param":8,"op":"<","value":1},{"stat":"item_addskill_tab","param":9,"op":"<","value":1},{"stat":"item_addskill_tab","param":10,"op":"<","value":1},{"stat":"item_addskill_tab","param":16,"op":"<","value":1},{"stat":"item_addskill_tab","param":17,"op":"<","value":1},{"stat":"item_addskill_tab","param":18,"op":"<","value":1},{"stat":"item_addskill_tab","param":24,"op":"<","value":1},{"stat":"item_addskill_tab","param":25,"op":"<","value":1},{"stat":"item_addskill_tab","param":26,"op":"<","value":1},{"stat":"item_addskill_tab","param":32,"op":"<","value":1},{"stat":"item_addskill_tab","param":33,"op":"<","value":1},{"stat":"item_addskill_tab","param":34,"op":"<","value":1},{"stat":"item_addskill_tab","param":40,"op":"<","value":1},{"stat":"item_addskill_tab","param":41,"op":"<","value":1},{"stat":"item_addskill_tab","param":42,"op":"<","value":1},{"stat":"item_addskill_tab","param":48,"op":"<","value":1},{"stat":"item_addskill_tab","param":49,"op":"<","value":1},{"stat":"item_addskill_tab","param":50,"op":"<","value":1},{"stat":"item_addskill_tab","param":56,"op":"<","value":1},{"stat":"item_addskill_tab","param":57,"op":"<","value":1},{"stat":"item_addskill_tab","param":58,"op":"<","value":1}],
  "playerStats": [{"stat":"level","op":">=","value":20}],
  "excludeAreas": [1,40,75,103,109],
  "hide": true,
  "comment": "Hide magic and rare weapons from character level 20, except useful ones"
}
```

### Hide magic armour from character level 20, except useful ones

Magic armour without +All Skills, +class skills, +a skill tab, Faster Cast Rate, Faster Hit Recovery, Faster Run/Walk, Increased Attack Speed or Magic Find, once your character is level 20 (as Sully’s magic gear hide), outside town (one check per class and tab, as in the weapon rule; oskills are not kept). Class armour, quest items and mythical bases are excluded.

```json
{
  "excludeItemCodes": ["7wd","dd1","m01","m02","m03","m04","m05","m06","m07","m08","m09","m10","m11","m12","m13","m14","m15","m16","m17","m18","m20","m21","m22","m23","m24","m25","m26","m27","m28","m29","m30","m31","m32","m33","m34","m35","m36","m37","m38","m39","m40","m41","m42","m43","m44","m45","m46","m47","m48","m49","m50","m51","m52","m53","m54","m55","m56","m57","m58","m59","m60","m61","d33","g33","hdm","hfh","hst","leg","msf","qf1","qf2"],
  "itemTypes": ["armo"],
  "excludeItemTypes": ["clas"],
  "quality": "magic",
  "isIdentified": true,
  "itemStats": [{"stat":"item_allskills","op":"<","value":1},{"stat":"item_fastercastrate","op":"<","value":1},{"stat":"item_fastergethitrate","op":"<","value":1},{"stat":"item_fastermovevelocity","op":"<","value":1},{"stat":"item_fasterattackrate","op":"<","value":1},{"stat":"item_magicbonus","op":"<","value":1},{"stat":"item_addclassskills","param":0,"op":"<","value":1},{"stat":"item_addclassskills","param":1,"op":"<","value":1},{"stat":"item_addclassskills","param":2,"op":"<","value":1},{"stat":"item_addclassskills","param":3,"op":"<","value":1},{"stat":"item_addclassskills","param":4,"op":"<","value":1},{"stat":"item_addclassskills","param":5,"op":"<","value":1},{"stat":"item_addclassskills","param":6,"op":"<","value":1},{"stat":"item_addclassskills","param":7,"op":"<","value":1},{"stat":"item_addskill_tab","param":0,"op":"<","value":1},{"stat":"item_addskill_tab","param":1,"op":"<","value":1},{"stat":"item_addskill_tab","param":2,"op":"<","value":1},{"stat":"item_addskill_tab","param":8,"op":"<","value":1},{"stat":"item_addskill_tab","param":9,"op":"<","value":1},{"stat":"item_addskill_tab","param":10,"op":"<","value":1},{"stat":"item_addskill_tab","param":16,"op":"<","value":1},{"stat":"item_addskill_tab","param":17,"op":"<","value":1},{"stat":"item_addskill_tab","param":18,"op":"<","value":1},{"stat":"item_addskill_tab","param":24,"op":"<","value":1},{"stat":"item_addskill_tab","param":25,"op":"<","value":1},{"stat":"item_addskill_tab","param":26,"op":"<","value":1},{"stat":"item_addskill_tab","param":32,"op":"<","value":1},{"stat":"item_addskill_tab","param":33,"op":"<","value":1},{"stat":"item_addskill_tab","param":34,"op":"<","value":1},{"stat":"item_addskill_tab","param":40,"op":"<","value":1},{"stat":"item_addskill_tab","param":41,"op":"<","value":1},{"stat":"item_addskill_tab","param":42,"op":"<","value":1},{"stat":"item_addskill_tab","param":48,"op":"<","value":1},{"stat":"item_addskill_tab","param":49,"op":"<","value":1},{"stat":"item_addskill_tab","param":50,"op":"<","value":1},{"stat":"item_addskill_tab","param":56,"op":"<","value":1},{"stat":"item_addskill_tab","param":57,"op":"<","value":1},{"stat":"item_addskill_tab","param":58,"op":"<","value":1}],
  "playerStats": [{"stat":"level","op":">=","value":20}],
  "excludeAreas": [1,40,75,103,109],
  "hide": true,
  "comment": "Hide magic armour from character level 20, except useful ones"
}
```

### Hide white gear with 0 or 1 socket from character level 10

Normal-quality weapons and armour with at most one socket, white class items among them, once your character is level 10 (as in Sully’s filter), outside town. That includes bases you could still socket (Larzuk’s quest, a Socket Donut), so skip it if you want those. Superior items stay; quest items, mythical bases and throwing potions are excluded.

```json
{
  "excludeItemCodes": ["7wd","dd1","m01","m02","m03","m04","m05","m06","m07","m08","m09","m10","m11","m12","m13","m14","m15","m16","m17","m18","m20","m21","m22","m23","m24","m25","m26","m27","m28","m29","m30","m31","m32","m33","m34","m35","m36","m37","m38","m39","m40","m41","m42","m43","m44","m45","m46","m47","m48","m49","m50","m51","m52","m53","m54","m55","m56","m57","m58","m59","m60","m61","d33","g33","hdm","hfh","hst","leg","msf","qf1","qf2"],
  "itemTypes": ["weap","armo"],
  "excludeItemTypes": ["tpot"],
  "quality": "normal",
  "sockets": {"max":1},
  "playerStats": [{"stat":"level","op":">=","value":10}],
  "excludeAreas": [1,40,75,103,109],
  "hide": true,
  "comment": "Hide white gear with 0 or 1 socket from character level 10"
}
```

### Hide plain arrows, bolts and throwing potions from character level 10

A quality range: up to superior (inferior, normal, superior), from character level 10 (Sully’s level for plain quivers), outside town. Magic, rare and unique quivers stay, since ESR has hundreds of quiver affixes.

```json
{
  "itemTypes": ["bowq","xboq","tpot"],
  "quality": {"max":"superior"},
  "playerStats": [{"stat":"level","op":">=","value":10}],
  "excludeAreas": [1,40,75,103,109],
  "hide": true,
  "comment": "Hide plain arrows, bolts and throwing potions from character level 10"
}
```
