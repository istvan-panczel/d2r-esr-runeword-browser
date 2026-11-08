# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [1.61.1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.61.0...v1.61.1) (2026-11-08)

### Bug Fixes

* **game-data:** keep amulet and ring sanctification with the new jewelry marker ([6718a0e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6718a0ecdf49e90124e156aec7dd78eea00e9ba5))
* **game-data:** read elixir recipe quantities once and drop the answered perk bugs ([aa9253e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/aa9253e46f2e3e203afb63909bc9c8bb3fd66850))
* **game-data:** stop D-stoning at its void blocker rows ([ec6f41a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ec6f41ae6ff68fd12784552f9e6f51dad33f3ab2))

### Documentation

* **guide:** reflect the ESR 3.3.02 fixes to elixirs, perks and D-stoning ([f82ce53](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f82ce53fd1b9f76d1e402382ca7eab83fb6a194f))

### Chores

* **esr-update:** add the patch-note check PDF and cover the new data sections ([42657a5](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/42657a5bf20a911289ea02d1e961f6ae27110934))
* **game-data:** update to ESR 3.3.02 ([4317b69](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4317b6987742646d332a776676dc4a5ebe9ee55f))
* **loot-filter:** bump the loot filter plugin version to 1.8.2 ([d50d959](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d50d95949b675938e218501b6d5e5a7fed815c21))

### Tests

* **data-sync:** read the pre-3.3 page layouts from frozen 3.2.24 fixtures ([08cad61](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/08cad614ad9001b05baf2bea674100d97485a0d7))

## [1.61.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.60.1...v1.61.0) (2026-11-07)

### Features

* **game-data:** read skill combo bonuses and the old synergy layouts from skilldesc ([e15607f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e15607f0080ed4b87f20431d1a8cada28e54e273))
* **game-data:** resolve fanatic swing's elemental armors combo to the three armors ([fffca25](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fffca2539155d41437a41fbab0fccfed621861d5))
* **skills:** show skill combo bonuses in an amber box above the card tabs ([19f5571](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/19f5571a5ee9f12ff079abacb6ee414f69093b70))

### Bug Fixes

* **skills:** drop the icon and heading from the combo bonus box ([640726f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/640726f6999bd98843b5bcedd74a5e8e8feb9979))
* **skills:** leave the combo bonuses out of the skill peek ([d10a3ca](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d10a3cae65665a8ed884ca155cce7d05d2a991a1))

## [1.60.1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.60.0...v1.60.1) (2026-11-07)

### Bug Fixes

* **campaign-map:** note that alien artefacts drop for everyone in 3.3 by mistake ([232ca1f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/232ca1f84d2275208e921a75604901c10f1c5e0b))
* **specializations:** apply the mod author's answers on three unbacked perks ([4bf1a3c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4bf1a3ce4fad0efab79126945241bf915e01a8ff))

### Documentation

* **esr-update:** record the mod author's answers on the 3.3 perk warnings ([f2d8b29](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f2d8b294984860a7e99ed27ece1c8828335a3dd2))
* **guide:** apply the mod author's answers on the 3.3 perk gaps ([53c1d6f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/53c1d6f84077c19bab51c192fbf2d9a2b26789f4))
* **modifiers:** add the mod author's pooled dodge answer to the dodge block ([f1e35bf](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f1e35bf8529714249870db01a7260270f6c3c464))

## [1.60.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.59.0...v1.60.0) (2026-11-07)

### Features

* **elixirs:** add the elixirs page with level, bonus and perk values ([7e871a6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7e871a6f08b402f52ffc4a21d788278fb53d3654))
* **elixirs:** link the page with the guide note and the modifiers block ([85ee7eb](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/85ee7eb72df2cb9abb5b2e1dbd8f3f6ac9dc39f2))
* **game-data:** generate elixirs.json from the esr 3.3 utility potions ([bc4482c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/bc4482cfec77924bcaef0c84b03b74c1fa6c1598))
* **game-data:** specializations bundle and perk icons from the esr 3.3 files ([ded1a83](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ded1a83a8942685f29c787aab31bf7d372cc71a0))
* **guide:** link the official specializations page ([691fbf7](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/691fbf737d559425f961ffa476ceac38094a413b))
* **guide:** make /guide the single overview of every note ([c22d712](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c22d712d3264d717d2537ce50625f0943392a0c1))
* **modifiers:** crushing blow damage input in the crushing blow calculator ([a5b8119](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a5b8119d14864f2724b75bfdfd79186f2cf1920a))
* **modifiers:** explain crossbows, maximum curses, socketed effect and utility potion stats ([01763a4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/01763a4c452aa0a7159c1bf3b4a84b750fd549e2))
* **specializations:** link elixir names on the perk cards to the elixirs page ([a547a56](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a547a56d06414b4bc6f8dc81c9beec71e64dff16))
* **specializations:** specializations page with perk deep links ([c017021](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c0170211fa329e9eba2c645541b7b294e64f1f3e))

### Bug Fixes

* **builds:** map the mythical arcane staff to the weapon slot ([96d4624](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/96d4624dec2d7c3749afe914dd1d1793365fdd9a))
* **builds:** outdated anointment on item change, item type pick for unknown bases ([d002134](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d002134832a07b587210b61904666e65f6e0b947))
* **data-sync:** read the unfilled esr 3.3 bleed duration as over time ([5617c80](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5617c802a85b9d7b9ee32349453e949ac995a2ae))
* **game-data:** bump the bundle schema for the esr 3.3 shapes ([b8cc957](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b8cc957b8f422989d869175335c5bca59622c04d))
* **game-data:** open the slot group's first pool for esr 3.2 anointment links ([671db5c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/671db5cfc3bdfc18390292d9e2c37fa8c41820c7))
* **game-data:** readable crucible group titles and families for the other cube recipes ([a99e67c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a99e67cf3a3cf721529514a5507c2314b6f04e1c))
* **home:** the esr wiki overlay is built into the game since esr 3.3 ([4906db3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4906db36cb9d08ebd44a83ed0d0a82a6f97a1d5d))
* **loot-filter:** check in game prints the stats a formula reads ([04db50e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/04db50e183b0e101271692617e56e7b88633c604))
* **loot-filter:** prune emptied languages when the file is written ([06507e0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/06507e0f2c755fafe5a88ba116476b2d2690bfc4))
* **loot-filter:** test tab switches off rules with unknown formula names ([c5c1ab0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c5c1ab0571ceb5bcf4079513211d3930cf91b077))
* **socketables:** let the long esr 3.3 bonus label wrap on the cards ([1e7fb24](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/1e7fb246854f40193684a622085180ce7b61137d))
* **terror-zones:** keep the stars of unchanged zone groups ([6477856](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/647785689598394468a624f13e8876d5ed309bbd))

### Documentation

* **elixirs:** document the elixirs page, bundle and open questions ([8c87a49](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8c87a49b85efa9bd92de59b9b4e1486a330c32a4))
* esr 3.3 counts, sizes and examples in the feature docs ([30d96fb](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/30d96fbfb4cc1e067573916ce3118f6130451c96))
* esr 3.3 coverage, prompt sizes, picker names and icon counts ([cb0f3a0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/cb0f3a0d16220b461383c5ade69e3c73682c3aeb))
* **guide:** add the specializations and elixirs notes ([a5546eb](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a5546eb7a26ed1c27ff493274bd5fb23824e3191))
* **guide:** date the page-change remarks and per-type anointments for esr 3.3 ([5a44aea](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5a44aead2050099b2182e53272c59165dfd44d96))
* **guide:** describe the 3.3 monster overhaul and experience curve ([dcd88df](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/dcd88dfffa683f0c90022db7a170aceb9fd0a2a4))
* **guide:** describe the single /guide overview and the unrouted map ([ab55268](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ab55268ae5c4bd1896ba43e26413c5a2c911a0e9))
* **guide:** link the specializations page and the perks the notes name ([ffa648a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ffa648a9188239d531c9400b01e62174697670e8))
* **guide:** point the start here note at the overview, not the removed row ([d75dc9f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d75dc9ffa94e1940b548b2e94093a7a350d00f1e))
* **modifiers:** cite the mod author on additive deadly strike damage ([05cce0c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/05cce0c3ef7434ddd1f7cd611941234c45858e7a))
* **modifiers:** document the 3.3 stat blocks, their facts and open questions ([5e97ed2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5e97ed2a8a09cad01897a9b3487df7862bd414ca))
* **modifiers:** esr 3.3 element crit, demon limb and enchant formulas ([84608ea](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/84608ea54e5de536b43a47e9efcac37aa9cccb63))
* **modifiers:** whirlwind hits count as a third of an attack for every-n-attacks procs ([bfe5f8a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/bfe5f8a839418a9bb6a30e217c409492fae23124))
* **specializations:** feature doc, bundle and route listings, esr-update notes ([a858084](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a858084855f7ae5cbda8588596d659904bd63110))

### Chores

* **esr-update:** reference expectations at esr 3.3 ([7fdef70](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7fdef701c78153b48f0cddd0a803da1ccc7e7f85))

## [1.59.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.58.0...v1.59.0) (2026-11-07)

### Features

* **game-data:** skills.txt names in lootfilter.json for loot filter formulas ([0085482](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0085482444299a308cd34ecd5c3f75627519d019))
* **loot-filter:** edit per-language texts and test in a game language ([313aa57](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/313aa57675d0af0a30dfb25d284df9d2cd9a760e))
* **loot-filter:** formulas ([004efc3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/004efc30f51e1104771b62af669a3ad79bd125c3))
* **loot-filter:** plugin 1.8.2 stat values and unidentified items ([fcd106d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fcd106dcb8609e75b3740c70dedf02af979a3567))
* **loot-filter:** show rule ([f52a116](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f52a116a48d5a5a2883f89a5c5f6ee61675a3fad))
* **runewords:** show the page's socketable bonuses per item-type group ([08bdb78](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/08bdb78fc271e4fcf543a23292d881da7b2e220e))

### Bug Fixes

* **builds:** anointment pool from the item's base type for ESR 3.3 ([bb6bd2a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/bb6bd2a76a67b852a8200ea68b79350fec090943))
* **campaign-map:** alien artefact drop and page-name notes for esr 3.3 ([7178d57](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7178d570552d187424005d1a83bf750e841513c4))
* **data-sync:** parse the ESR 3.3 runewords and gemwords layout ([29ac437](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/29ac437365359bdbc7f007c96650c05494fc3448))
* **game-data:** format the ESR 3.3 bleed duration (%.2f) ([fa8e025](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fa8e0259a2cfa1f1aaed8830d6c0570e682b8985))
* **game-data:** per-item-type anointment pools and perk sanctification for ESR 3.3 ([ea634fc](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ea634fc7a432836e9270c276b4674da67226c9bb))
* **game-data:** perk conditions and cube families for ESR 3.3 recipes ([c729a76](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c729a76445d262e5b042c80cc7e934a272802e60))
* **game-data:** read the ESR 3.3 weapon mastery rows and superior frequencies ([52cfdfb](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/52cfdfb1794147b812d0bf68bf45abbee3f8e98e))
* **game-data:** read the ESR 3.3 weapon mastery rows and superior frequencies ([865c893](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/865c89379d149a2a28cc345deadf44d445b3f0eb))
* **loot-filter:** accept localised level names (plugin 1.8.2) ([6589dad](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6589dad83fe431fd32b32e8c3d70b3da8e52685a))
* **loot-filter:** colour codes from the 3.3 guide ([285e6f1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/285e6f1115ffeaa095e430e4b8772bcfc87dbc90))
* **loot-filter:** keep the gem grades as the misc browser ladder in ESR 3.3 ([d983248](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d983248994327e31a1e40ebc6a94f04ffa38d230))
* **loot-filter:** per-language editing stays on the edited language ([2ceda91](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2ceda91979a9cb40c0b92aad39c826a65086da65))
* **loot-filter:** the 16 per-level stats of ESR 3.3 in STAT_SCALES ([c14d2d3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c14d2d3e84adca879306ba815a224eb84523d868))
* **socketables:** label the bonus columns after the ESR 3.3 gems.htm headers ([95c6c05](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/95c6c051914be3ec770403dd00023ad74f1e901d))
* **terror-zones:** schedule for ESR 3.3 and watched-group reset ([16c2da5](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/16c2da594ef7d74ad540847e2c851001fab25792))

### Documentation

* **game-data:** masteries, superior frequencies, anointment pools and perks for ESR 3.3 ([7066ac7](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7066ac767d95dc508e288db7158047f5ecf6bde9))
* **guide:** corrections and additions for ESR 3.3 ([862a9c5](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/862a9c545b329479ae3938e4d8f9a3b58ae32839))
* **loot-filter:** chat once per item and the launcher's chat switch ([7aa6c64](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7aa6c647a485860cdc234a3266cabc4b49898297))
* **loot-filter:** checklist of the 3.3 guide against the editor ([590d3d2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/590d3d23910b9084018d318af0df938a041011cc))
* **loot-filter:** the 3.3 guide (plugin 1.8.2) ([e6197ff](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e6197ffbba88a594de870b5348b020ea62cd151d))
* **modifiers:** apply the mod author's answers and the ESR 3.3 facts ([61f88ed](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/61f88ed7fd3519be2c18ee611fa7762c9ba74f35))
* **uniques:** the weapon mastery variant notes are property lines since ESR 3.3 ([824813f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/824813f6894241e268f91bb045c90dde9360fb3e))

### Styles

* **loot-filter:** format text.ts ([42b90ee](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/42b90eee2d775615749347c062b462e74fc8ab36))

### Chores

* **game-data:** update to ESR 3.3 ([070e6ef](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/070e6ef759a84fa0ca00da65f6f7a10df9587f61))
* gitignored owner-notes folder for owner checklists and Discord drafts ([f1b0529](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f1b052922735711bfb41687866452c69e89870d4))
* **loot-filter:** refresh Sully's QoL template to v0.7.0 ([461a21d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/461a21d0f869b2a832ccef66b27eb0f6145a1446))

### Tests

* **stash:** item text floor 94 % for the ESR 3.3 stash fixture ([8f583f0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8f583f0fb4d6d16afd31f590ce4d33b7d656a728))
* **stash:** the ESR 3.3 stash fixture ([de4471f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/de4471f3a6d1f8bfd6bec37b43613cff4580428b))
* **terror-zones:** owner's ESR 3.3 in-game slots as ground truth ([e7b1484](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e7b1484354a722ebcd78a301896f8592ed0d1116))

## [1.58.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.57.0...v1.58.0) (2026-11-07)

### Features

* **campaign-map:** boss section on endgame map zones ([0d4a7e1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0d4a7e172677b7b91bfecf2d34adab9a55dfb0c3))
* **game-data:** cube page notes, guide links, odds and per-row details ([8968710](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/896871012018ffd194f574b457a381fd249388c2))
* **game-data:** endgame map boss rewards worked out from the treasure classes ([4566643](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4566643a5bb8027098c2d0a6c70356b6e46367b9))
* **game-data:** item icons on the cube, materials and enhance pages ([d1abdf2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d1abdf280a01ff500491dab6b6d256e525c3a753))
* **game-data:** sanctification outcomes and D-stoning caps ([a119d98](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a119d982c897ccb052d4ef4df079b320a1dcd1ad))
* **game-data:** superior affix pool with odds ([872cb5f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/872cb5f65303cc937f491a4a13499b67215e1cd1))
* **game-data:** weapon mastery bundle from cubemain and the token descriptions ([406342a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/406342a36bc7790f37e20c98413db09a409cab37))
* **guide:** endgame map bosses note and ::map-bosses directive ([0f4b151](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0f4b1519f61063175d1e9483e08e04b4e5ef35b3))
* **tooling:** esr:review and esr:diff cover the features since the skill v2 ([20f5d72](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/20f5d72e73f8e81d1868d2be6ae1d3c34789fd1c))
* weapon mastery panel on class weapon bases and on skill cards ([e036417](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e036417c4eb91293bbc174000cfca412c7f3b7da))

### Bug Fixes

* **campaign-map:** map boss review fixes ([5c90b8a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5c90b8af02f605814d18a39c8f82c51bb6291dca))
* **game-data:** make the cube recipes match the official Cube Recipes page ([94a7449](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/94a74499780ab33dd91a0d984d5c70acde72ba5d))
* **game-data:** weapon mastery review fixes ([e589960](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e589960c163479831d662b1280d480bc151cbe64))
* **game-data:** write durability repair like the game (descfunc 11) ([a358b6b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a358b6b32416c09bf196366fc5e4031fa706e740))

### Documentation

* **guide:** official cube page footnotes in the guide notes ([2f7d531](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2f7d5319b3062e2a990db6621be39bbd3d96b9fe))
* map bosses in the campaign map, game data and guide docs ([d4cb35e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d4cb35e430c8798b2a935808a0093299bf2587b4))
* weapon mastery bundle, panels and guide note pointers ([f774044](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f774044ff0c28790f8f4b417b208f29eef8efd8b))

### Chores

* **esr-update:** cover the features added since the skill v2 ([454bc2e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/454bc2e6e4c8f54cb78a263ab83f37b72fb4a3f8))

## [1.57.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.56.0...v1.57.0) (2026-11-06)

### Features

* **guide:** combat glossary terms and more difficulty penalties ([423e91e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/423e91eb432edbc9a77ea512f0f3694d312363c4))
* **modifiers:** generate a modifiers bundle from the game files and ESR plugin configs ([90d63f8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/90d63f8247eaa70e563ad652aed2a2049b60577b))
* **modifiers:** modifier peek on item lines ([130b2c9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/130b2c943476e62f52f32c5a5b598eb859518acc))
* **modifiers:** modifiers reference page with fact-checked explanations and calculators ([e6ac2a8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e6ac2a85b8e632a214a77a9c51c75c66ff91b4d4))
* **skills:** add ESR's skill information page to skill details ([36a18af](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/36a18afa50e7a8a9dd703a17e8bd20b3cfc9dcc4))
* **skills:** evaluate skill calc formulas per level (skillcalc bundle + engine) ([fcfe83e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fcfe83e68a828fbeaac0c40c72a846b64b518a49))
* **skills:** show per-level skill values on the Skills page and build trees ([42f9629](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/42f9629a6bff030d68b0114a4024c0eb27de4012))
* **skills:** skill card with Values / Items / About tabs ([c3ec65c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c3ec65cf1c097e536d6befb4c4726f1adae53949))
* **skills:** skill peek on item property lines ([4087a67](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4087a6711e2b714a2873fa008e30fdcfefd3eb17))

### Bug Fixes

* **modifiers:** final review and E2E fixes ([9d7bc62](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9d7bc620356d15504512977bfea8ab77ff068e2b))
* **modifiers:** review fixes for the content, calculators and peek ([c79a35f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c79a35f1cd0b4b04a4630323949456a27f494be7))
* **skills:** final review fixes, docs and in-game checklist ([6ccb637](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6ccb6374e4838e2243a46a2ab85f09815d5ce0b8))
* **skills:** match the game's calc compiler, tooltip order and synergy reads ([b16af8e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b16af8edea7f01e609fe0489a87b779bbdf0354f))
* **skills:** review and E2E fixes for skill levels and the skill peek ([3f39ecb](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3f39ecbef5e2068e6dd813fe49a833c51971f094))
* **skills:** skill information wording and heading duplicate ([fec8146](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fec81464e057a82a8c68b98521f9e4f02c2618ae))

## [1.56.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.55.0...v1.56.0) (2026-11-06)

### Features

* **terror-zones:** give the widget a frosted glass look ([55b8783](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/55b8783ac08d33526bbe4ebba634e851a0e25374))
* **terror-zones:** show a purple TZ mark and larger boost lines ([fc327a4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fc327a46be671e91de8f6390d6ddd3cad402e167))
* **terror-zones:** show the terrorized zones now and next on every page ([b210e47](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b210e47bb089dff8ba65d9ab9a69addcfb80eb80))

## [1.55.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.54.0...v1.55.0) (2026-11-06)

### Features

* **ascendancies:** add a how-to panel with orb locations and tier challenges ([7af9a8a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7af9a8a3c08c9f027bfe55dce8a041ff9782fff3))
* **campaign-map:** make the selected area easy to spot and show it on arrival ([2d3dd61](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2d3dd61fc08473aa2c1a1123b3c314b9f194930d))
* **campaign-map:** put the search, section tabs and view toggle on a toolbar card ([89aaed2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/89aaed2ea590797e1ff1373a73f95c7361eb8f35))
* **data-sync:** parse the ascendancy challenges and each stone's unlock recipe ([0034602](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0034602e19bacb9f38ffbdc645f1ff0660de9234))
* **game-data:** move the Enhance section tabs into the filter panel ([d3b8201](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d3b82013b240e350421ad5a95a4a130c04bfde61))
* **game-data:** put the Materials groups, cube families and Enhance outcomes on cards ([d96c3ed](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d96c3ed59dec3a278d7c84b6b2b82e1071838a08))
* **loot-filter:** card the library intro and toolbar and the editor tab row ([277c5b2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/277c5b23661884f3dd4633eb4a3a7d92c3554a14))
* **stash:** ignore coupons on the All Items page by default ([bcad740](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/bcad740664faa6f96e4f3a9e4773de616e6020af))
* **stash:** peek at an item's whole card from the All Items table ([1a400ce](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/1a400ce179fed0b46f4ab5f16d11ac3a72272a84))
* **ui:** put the Game Data and My Stash sub-tabs on a toolbar card ([6ccdb75](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6ccdb75a64c31acd0ad67cd40c14967cd30180bc))

### Bug Fixes

* **ascendancies:** drop the guide note link from the how-to panel ([3daaeaa](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3daaeaae2d63ac973b9aec5954f300f3101600f2))

### Documentation

* document the ascendancy challenges, unlock recipes and how-to panel ([d0168b4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d0168b44809d135b72f4984e8fd036505b32a8dd))
* document ToolbarCard and the page sub-tab classes ([82924d2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/82924d2c17b696e547ca53abe584a61105ebcada))
* **guide:** mention the orb locations and tier challenges on the Ascendancies page ([8d17290](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8d172905710beb64f4f29f68e246dd017e478878))

### Chores

* **esr-update:** re-check the hand-maintained ascendancy orb table after a release ([732708f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/732708f06f3f3cc22743204f4c63b3c8eddc95c2))

## [1.54.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.53.0...v1.54.0) (2026-11-05)

### Features

* **campaign-map:** add the campaign map page ([f2875b0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f2875b06ef0cdf12887a467b19fe5d9c885769f5))
* **loot-filter:** add 25 generated minimap icons in the style presets' colours ([bba56bf](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/bba56bf773dab47c603a9403da86c259fa3287d7))
* **loot-filter:** add a .sprite encoder that writes Sully's icon header ([308b146](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/308b14682183a3bce1b34eb9081c1d3d1bd828cd))
* **loot-filter:** add a bundled asset registry and style presets ([138f2e6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/138f2e6fa6f5e8d6ab13698e01ee559783a8b4e7))
* **loot-filter:** add a NoIcon style copy right after its base style ([b65cd31](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b65cd31a1919cd0af10d7d9f926985579d4515b3))
* **loot-filter:** add basic and advanced views to the rule editor ([cf2181d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/cf2181de094114a99057a50f7e2dab64fec49d6c))
* **loot-filter:** add the AI help page and the Import AI answer loop ([531e88c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/531e88cde814717671b6aef56807151db40cf05b))
* **loot-filter:** basic/advanced view on the Styles tab ([88474a6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/88474a65229ae420ad66fac2d411a23f6ed8abae))
* **loot-filter:** build LLM prompt packages and read LLM answers ([8334b39](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8334b39ec714525123474e9ebcc8c22fb8256423))
* **loot-filter:** default the example rules to the generated icons ([6bf9e84](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6bf9e841dd4b083a524f5d270f53c48f2f2a4b9f))
* **loot-filter:** drop apostrophes from AI prompt file names ([f4cc4cb](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f4cc4cb57bb9cd5a1c8bf841ac342b90fb4c08dc))
* **loot-filter:** drop the sounds.txt names from the Full AI prompt data ([ac021c1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ac021c1441101dc93880942e8e8462b5d6daa4e1))
* **loot-filter:** example dialog's Select all leaves hide rules out ([81cb201](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/81cb201534bff58b906fa4d85b76a9e2adb36459))
* **loot-filter:** example hides at Sully's level gates, new ESR item examples ([ac784e9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ac784e98798648c9827c82dd054e9b86701e1d19))
* **loot-filter:** icon grid picker and sound list with play buttons ([cf334ae](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/cf334aed0e4d5fcc23be22975b73daf0f52e819f))
* **loot-filter:** name AI drafts after their title and start from saved filters ([2849ea9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2849ea93e59f09d44d8c0bd9b580774ea0defc4f))
* **loot-filter:** pick a starter set from sixty example rules ([2a65198](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2a65198127493999c941f5f5bb89033198a04de1))
* **loot-filter:** pick example rules as the AI help starter ([93425a9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/93425a9d1539a7246a2edf0396db45dc05c2da40))
* **loot-filter:** rebuild the example filter from the example rules ([c9218d9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c9218d937f9bbfb60e0dea1ef70c06688306cf65))
* **loot-filter:** resizable rule list with a keyboard-accessible splitter ([273e212](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/273e21215ae892129c814fede21d6d63c72e7b24))
* **loot-filter:** show a rule's comment as its row's main line ([1e2af47](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/1e2af4753831cc7a16d7739bdfd999f7a052caad))
* **loot-filter:** show complete example rules, style presets and asset notes in the AI prompt ([0de5543](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0de5543d9198f164ea3856f8a9429205c06ca540))
* **loot-filter:** starter wording in the example rules dialog on the AI page ([40ec670](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/40ec6701d5cc2c681f697c90068fc1a438b6a63c))
* **loot-filter:** style first, then tweak ([3a298c3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3a298c337aa2aecf8e2266b4aa48e37282dbd8bf))
* **loot-filter:** style presets carry their minimap icon ([d049a71](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d049a71e5811c8037280f4ba1c0edf1e06b49022))
* **loot-filter:** style previews with their minimap icon everywhere a style is shown ([98513bf](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/98513bff4c6123496e1bd2d9bf0f0ff9b6894066))

### Bug Fixes

* **game-data:** correct areas.json and add terrain, map items and quest icons ([d72180d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d72180da88bd94a6b91794b3465ca230adaeb8c8))
* **loot-filter:** faster Select all and title-only checkbox names in the example picker ([b45e529](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b45e529d38901bbd540bf3f2f83516004b4bf7ac))
* **loot-filter:** keep quest, mythical and skill items out of the example hides ([5df408e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5df408eced1aacf54aa3974f2d9872b79c38d3b6))
* **loot-filter:** keyboard and screen reader fixes in the sound and icon pickers ([ed2cb76](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ed2cb765a73a206a5fb8366b72cb2c489f68e0ce))
* **loot-filter:** no example dialog on New filter, firmer JSON output rules for the AI ([7f62c9a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7f62c9a56349a69d1cb684dace1345b92db1f931))
* **loot-filter:** picking a style also clears a wrong-shaped own value ([b7cab39](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b7cab396cc992dcf9e2caf7f68f55755fe215537))
* **loot-filter:** review fixes for the AI import ([f94a7dc](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f94a7dc51925c712c1530d69a32cbaa707ab2ae4))
* **loot-filter:** save a style picked in the rule editor with the debounced flush ([4983e15](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4983e1594bd6f894b5fff50b7c29f477c83017a7))
* **loot-filter:** save the added example rules with the debounced editor flush ([e00cf1b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e00cf1bbee7427fa6b4a689f16357b2ad368a52e))
* **loot-filter:** scroll to the problems after the AI help page's first import ([27a5e71](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/27a5e71f65c7c834004ac700df0ac7090707638e))
* **loot-filter:** show what a rule's style sets and make Use style a Basic field ([09c44ba](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/09c44bad6c60bda2aaf4ba9bb90638294cceaff3))
* **loot-filter:** smooth splitter drag, splitter value text, readable touch rows ([181062a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/181062aab7e62e1bdbdd758e38ec9e4413c17e5f))

### Documentation

* **campaign-map:** document the campaign map and its ESR update steps ([7059a86](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7059a864a090cb3674022cc676909fcae7f9ac91))
* list the loot filter icon generator in CLAUDE.md ([445b7b9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/445b7b9366bf15b7683a49ade5ab33773b2b3da9))
* **loot-filter:** current AI prompt sizes ([f22102c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f22102c30e8667a229c6a776b7c761d730d36439))
* **loot-filter:** document style first, then tweak and the new pickers ([ac48770](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ac487703ec65fe705c7e28ef9506313736a3e3d3))
* **loot-filter:** document the AI help page and close the LLM prompt backlog item ([7302de8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7302de839d65ab58df6776d255dc48e98613bc42))
* **loot-filter:** document the example icon defaults and example filter v2.0.0 ([3ef5696](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3ef5696db7e8b36e8ef28293c0629caadfd19c3c))
* **loot-filter:** document the example rules starter and the richer AI prompt ([a59e8a2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a59e8a28c88eb34be66aa036d3e0554b7913e83e))
* **loot-filter:** document the shared previews, the flush guard and the picker fixes ([49f0b4a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/49f0b4a2b573bccdac61e25e826506992adfcc28))
* **loot-filter:** example hides' level gates, new examples, select all rule ([beb2026](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/beb20264bf1257756116c3a308b95cc5bf74bf4a))
* **loot-filter:** presets with icons, picker icon handling, example filter v2.1.0 ([f2b8c60](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f2b8c605bc716ef33379660982be5b87a25545df))

### Chores

* **lint:** skip agent worktrees in ESLint ([ab1206e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ab1206eed7dc589d105312aea38a1e468df5b2c1))
* **loot-filter:** bump Sully's template to v0.6.13 ([d2726e4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d2726e42e70a00bff321fa313944598f02f21352))

### Refactoring

* **loot-filter:** one sprite canvas for every minimap icon preview ([d62c9dc](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d62c9dc395f96681678c56d87c55c69b94b0de0e))
* **loot-filter:** share the Basic/Advanced action gate and view toggle ([0c50775](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0c50775c7068ee106642af5dda7ff959de136243))

## [1.53.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.52.0...v1.53.0) (2026-11-04)

### Features

* **builds:** data model for build variants and alternative items ([6faaf89](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6faaf895987d4227ca5d41142df5ecd6987d868c))
* **builds:** edit build variants and alternative items ([9f8ef24](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9f8ef244b3b4046797fed58687d2cbfe7d024884))
* **builds:** merge build variants and alternative items ([b082c9a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b082c9aa2f4d0e5340ecb586a0e2fc50356c8c3d))
* **builds:** show build variants and swap alternative items on the detail page ([d9289da](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d9289dab35d3cfd2ca59efef55ab776316d24617))

### Bug Fixes

* **builds:** review fixes for build variants ([ac8a4b2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ac8a4b2665963b9e30ae7b770d010989fd99f066))

### Documentation

* **builds:** document build variants and alternative items ([5b486f4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5b486f4e099245f82ac24cbdbafc891f92d696b4))

### Refactoring

* **builds:** footer and label slots on equipment cells ([dff7978](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/dff7978afefff266fdbb4d8881f0d13d8f7b9c25))

## [1.52.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.51.0...v1.52.0) (2026-11-04)

### Features

* **layout:** merge the page width setting for wide monitors ([bedbf4e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/bedbf4e1100bb4e3fd313611f687c250787f9df0))
* **layout:** more cards and columns on Wide and Full pages ([efd388d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/efd388d3491b007caf1db18b880105c5678029c4))
* **layout:** page width setting with a header menu (Standard, Wide, Full) ([82e426e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/82e426e6561f6cd01b381561ea0843e6edb7711f))
* **loot-filter:** use the room of Wide and Full pages ([fc39ebc](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fc39ebcf6a21a857fc68d75af8e4c3a3b32ba20a))

## [1.51.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.50.0...v1.51.0) (2026-11-04)

### Features

* **home:** drop the outdated ESR IAS Calculator from the community tools ([c4276eb](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c4276eb450318c357e8186e713a93dc0eae37603))
* **home:** hide the New to ESR section until it is reworked ([a20fe97](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a20fe97a4706d961c1efd323026bcd527625a0eb))
* **home:** refresh the official and community link descriptions, add feature lines ([d82d092](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d82d0925573351b572481d61015b77290ed451b7))
* **loot-filter:** code editor with syntax highlighting and label chips in the JSON tab ([b929fc7](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b929fc7472521576e25be165ab9408aa265fe4ed))
* **loot-filter:** merge the JSON tab code editor ([e1e9e17](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e1e9e17a43b34dbf874a61437e57803c2726669f))
* merge the link refresh, repo hygiene, security checks and CodeQL fixes ([872ff8d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/872ff8d3a7fb89ddb014460ba2ec625efe61aeac))
* **tooling:** add esr:review and esr:user-data, extend esr:diff ([e5e7f19](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e5e7f19e4baaf43a5827acd68f5ae2b7e7e0be5b))
* **tooling:** flag ESR releases whose docs pages were not regenerated ([6738621](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/67386216b60868163b8261f6c0fbc37a380558a3))
* **tooling:** merge the esr-update skill rework, review tooling and the level 110 cap ([4f91cf3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4f91cf361df5cf857b980fed9260e5e10f169abb))
* **tooling:** merge the esr:review docs-lag check ([73e4fac](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/73e4fac11626ad76731f754852e14c0cf0d3bc8b))

### Bug Fixes

* **best-base:** allow character levels up to 110 ([078dbd4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/078dbd40f4e4a54eecfb909aa5f99583f78314a3))
* **parsers:** strip HTML tags until none is left and decode &amp; last ([35910f5](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/35910f52fb822675306447208eb18bf8fd73b27a))
* **profiles:** only load avatar images from Discord's CDN ([85fde72](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/85fde721ee54e0eb6d1e0b88922868f3922aa515))

### Documentation

* add a security policy ([4eff792](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4eff79281d010c88a29d2224c80929c8e40ac7a6))
* describe the npm release-age cooldown ([8d50a37](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8d50a37c8db90f28953eed555638563f93c631b6))
* **readme:** bring the README up to date ([a270532](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a2705327bdb1c3d0dd86b368a4b4dfea6dcc5e9a))
* remove the fork research, shipped specs and the guide PDF copy ([9328db2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9328db2c31cd6191368ecdd47e78da57595f2022))
* rewrite CONTRIBUTING, word the loot filter notes neutrally, refresh stash and setup docs ([9be7810](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9be78108cdd2e5ff4db5d1b888c683e6b6399eb8))

### Chores

* **deps:** merge the November 2026 dependency round ([0878fdc](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0878fdc57adfd81213e81a6c093a96e429f1ba3b))
* **deps:** only install npm versions older than 7 days ([adce7a1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/adce7a10d48b9c8aca2b6aa168d5086f122fb578))
* **deps:** update dependencies within their semver ranges ([ef2d446](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ef2d44693fce4544d8d282a56e68555948dd0b15))
* **deps:** update jsdom to 30 and lint-staged to 17 ([9d36e42](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9d36e42340b4bb9bd0c3791a4c6b1223eaa12ea1))
* **deps:** update lucide-react to 1.x ([d268c50](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d268c503187cf8059cf8aa5927500d4776148ccd))
* **deps:** update TypeScript to 6.0 ([453a11a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/453a11adcce79d56943af088ae7ecfc79c985cb9))
* **esr-update:** rewrite the skill around the review tooling ([29d9099](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/29d90995beb0ad266321b62a3338bce1defa7abb))
* **format:** format the whole repo with Prettier and keep it formatted ([b0080dc](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b0080dcf3273133f77c3b70d1972505eb64285f9))
* **game-data:** run the full test suite in game-data:update and keep the previous fixtures ([a180023](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a18002385d8ef0a17b77b6ab75317f1a2d6822aa))
* **git:** add secret, metadata and staged-file checks to the pre-commit hook ([34679cc](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/34679ccafc64b9f40e1a543708477c745298b3b1))

### Tests

* **game-data:** pin the hard-coded stat ids and descfuncs to the bundles ([e2e3d4b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e2e3d4bf29f8037299bb4b50b132ffccdee903be))
* use synthetic values for the personalized name and the sample UUID ([8de63db](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8de63dba015fdf10491a601c2ab5ea8178fe9ca9))

## [1.50.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.49.0...v1.50.0) (2026-11-03)

### Features

* **game-data:** add item, unique, set item and runeword names to stash.json ([3166bfc](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3166bfce6469414d0870432186e7368cadcf0f62))
* **game-data:** add the lazy itemtext.json bundle for the stash item text ([400bf21](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/400bf21d8c480f759dbf014555dae76a5bbd2350))
* **stash:** add socket filler bonuses, weapon damage and requirement lines ([bc513ef](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/bc513efd8468888ed737cfa69c7b300dcdfed5cd))
* **stash:** add the All Items page with table, tooltip cards, filters and stat filters ([fa818b7](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fa818b758ac2c1c31421f384e0a849b6e13f72b8))
* **stash:** add the All Items route stub, nav entry and the contracts doc ([29891e6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/29891e6a42aaef5e9c482cc14b61371f9bf2d2a8))
* **stash:** add the All Items rows, search, stat conditions, filters and sort ([7e4afb2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7e4afb210f6e09fbddd907b0fe8e5d45b428d388))
* **stash:** add the shared stash engine and the item text contracts ([9f9c56e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9f9c56eb24c269b8c3243e101685344f6e06dada))
* **stash:** explain the stash search in its help popover ([b8fd4aa](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b8fd4aa64100ec6c85c5a50a57aabb78da88d1d4))
* **stash:** give coupons their own Coupon quality filter on All Items ([cd7b8ab](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/cd7b8abf1c810c6e4909ee4304ad997b2dc25349))
* **stash:** keep the affixes, rare names, quality variant, defense and durability of items ([60251c6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/60251c619b0ffbeb2a1663507313db241aa29129))
* **stash:** merge the All Items page ([c287868](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c287868417a33d635268ca03a02454fe84a8bee6))
* **stash:** merge the All Items page with names, stat text, stat filters and the Coupon filter ([07a23bb](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/07a23bbf129d8164d87168fb26505cedbe8ab2e5))
* **stash:** merge the stat text runtime and itemtext.json ([814ace6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/814ace6636900e2d5c2c4bb0edef33f0568c4fd4))
* **stash:** render stash item text and stat values from saved stats ([88bec3f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/88bec3f9a75d7bc270c6e391e18b21264f04a8a5))

### Bug Fixes

* **stash:** correct required level rows and throw damage of the item text ([a2ec437](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a2ec43771e708a318f9643d50b818c11e5e5212d))
* **stash:** let item type words match names, and tidy the All Items stat labels ([88049b5](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/88049b54ef79919b1417c509d57c3e6eaa091ace))
* **stash:** merge the All Items page review fixes ([a483878](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a483878dc3afba61abba154978ce5d55e6e8842c))
* **stash:** read event / charged skills above id 1023 and fold two-hand damage ([0ac20c9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0ac20c978ba5ec1cb44f8255aec1417878ebe9df))

### Performance

* **stash:** move the item names to the lazy stashnames.json ([63872f7](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/63872f7008627eb63e884e4454e2f77d29234a50))

### Documentation

* **stash:** add the All items roadmap ([4b18055](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4b18055e1d1a5a08b6fc7eec15e413d6a303ed70))
* **stash:** document the All Items page ([76ba8fb](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/76ba8fb6f54e9af4333e519ea27ddae15fb7eb2b))

### Refactoring

* **game-data:** move the stat text renderer to engine/stats ([03a8e2b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/03a8e2b025bfa9eb652d640800f4ec41c078c672))
* **stash:** extract the shared stash page UI and hooks from the coupons page ([fa7f20d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fa7f20da20f9c997621c3758808c87c5cf92fd53))

## [1.49.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.48.0...v1.49.0) (2026-11-03)

### Features

* **game-data:** add coupon bases and base tiers to stash.json ([b62380d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b62380df4a6718d14b57000029138833a1bd9718))
* **game-data:** add stash.json for the shared stash parser ([fcd0140](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fcd014034367bf8b72f46d3a760e6ad011d5f1e1))
* **game-data:** add the Ancient Coupon recipes to stash.json ([e54ec3e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e54ec3efe6f4e92e888b41dda0144bf885effbc1))
* **stash:** add item type search, full item details and tier badges to the coupons page ([95aff26](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/95aff266d9912ebc194b076fffe522d18caa80fe))
* **stash:** add the My Stash pages with an Ancient Coupons table ([1e884ab](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/1e884ab2dd1ac14d0ee183c443b059407b637047))
* **stash:** merge the My Stash section with the Ancient Coupons page and the shared stash parser ([b95c311](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b95c311babd619fefc3a958aec5514f5fbb150b1))
* **stash:** parse the ESR Modern shared stash (.d2i) ([0414ab6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0414ab63b66fecb4686e816d1a893ba362041536))

### Bug Fixes

* **game-data:** flag a coupon Wild Card recipe with a wrong numinputs ([8620541](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8620541f8fb6e7cdbe66179129bcd15c453268ef))
* **game-data:** name a coupon unique without a string after its coupon ([2c7ff28](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2c7ff28d06069a562a5cea3616e935204c4e5963))
* **stash:** fix coupon counts, materials locations, statuses and uploads ([34c79b4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/34c79b4bf64660741e81dbaa0f065bdd15faa11a))
* **stash:** report a section too short for its header as a parse error ([a78ee79](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a78ee790db7f20aa2a1166e106e5a6f6141e5154))

### Documentation

* **stash:** document the My Stash feature and the stash file format ([1fa05bf](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/1fa05bf7d96447c440d01bb54e8cad96b630f559))

### Refactoring

* **stash:** drop the unused BitReader position setter ([4cdb93c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4cdb93ce64e8ddda3858dd66cfb3d9ca4938cd1a))

## [1.48.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.47.0...v1.48.0) (2026-11-02)

### Features

* **builds:** list the author's loot filters on the profile page ([3e12376](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3e12376b66b602089f2ec9e7a8ee567ff8a4ed5e))
* **home:** add a latest loot filters block after latest builds ([752d2e8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/752d2e8518c4e4b9bed016b5878568668088a1d9))
* **loot-filter:** accept a single-number activeInLevels with a warning ([3efa757](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3efa757b57cc490ca0ed45b16b26f1e2ff8b45a9))
* **loot-filter:** add a commented example filter for new users ([0ff8c60](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0ff8c6097852cab7f8f0fd7c638f321553e1e843))
* **loot-filter:** add draft, saved and sully editor routes with save, sandbox and update banners ([0bd36ff](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0bd36ff9c3e63b5261fdc465bb4c4e126c040acf))
* **loot-filter:** add the editor target and the draft model for sharing ([e2e71fa](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e2e71faa11302c3eee8d28a3a7e4473897c44d23))
* **loot-filter:** add the save, details and source fetch sagas for shared filters ([943539c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/943539c8386766fabad61c21bd08269735beef4a))
* **loot-filter:** add the Shared and My filters tabs to the library ([db48d2d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/db48d2d6dbfcad5cf512ac503a3b99faff07a422))
* **loot-filter:** add the sharing query module, row types and save-time metadata reader ([e5964b6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e5964b6659b1fa02c1d984c88130a152dcbe14dd))
* **loot-filter:** add the sharing slice and saga for lists, detail, likes, downloads and delete ([f0dd816](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f0dd81661438a064702e625be21e5875264c5f15))
* **loot-filter:** add the template and plugin version constants for sharing ([3c46591](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3c4659117696c91cbe3eebe439344e37f0687689))
* **loot-filter:** bundle the example filter as a second starter template ([5cabd9e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5cabd9e207575aab246b561d6f31b5047075b71e))
* **loot-filter:** download a shared filter from its card in the sharing saga ([0495619](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/04956191854d35b0079ceb3d0daa33cf969b2e43))
* **loot-filter:** drop the under development notice from the loot filter pages ([c3d4777](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c3d47772d1b54cce6f044796bc599977578f9726))
* **loot-filter:** merge loot filter sharing, drafts, the example filter and smaller icons ([d4aecae](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d4aecae9dc650068541ed863c2eaf7e24252923f))
* **loot-filter:** plan loot filter sharing, add the 005 migration and its types ([fb4c0d0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fb4c0d08b165ae52ed8015f394d5bd9335ee18cc))
* **loot-filter:** start the sharing saga before the loot filter and profile routes mount ([e086917](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e086917bd57748c283d0400e770605eebc1fe2c6))

### Bug Fixes

* **loot-filter:** open My filters for local drafts and keep ownerless drafts reachable ([9915059](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/991505908cc7d2873738ae7bfd4c24b9d323d754))
* **loot-filter:** protect unsaved drafts, private filters and sandbox edits in the editor ([db45e28](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/db45e285afa511e362e055d7efd2ddc8b55206a4))
* **loot-filter:** put the save status before the editor target and say when nothing changed ([0008dbc](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0008dbc1f76947e855ceb00f3a37093884aaa787))
* **loot-filter:** save copies of deleted sources and keep based_on columns within limits ([017839c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/017839cb20a168dba726e14ba77a80cc150cfca9))
* **supabase:** apply the 005 review: downloads index, initplan-safe policies, private-safe cap ([b13ebde](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b13ebde47b45d646fbdfb720fd47558cc6765c78))

### Performance

* **loot-filter:** shrink the bundled minimap icons to 128 px ([a587514](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a5875148884f00423e5bce30af9970f1fceb9e6f))

### Documentation

* cover saved loot filters, their likes and download counts in the privacy policy ([26421b3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/26421b3c545804202448e5d0be8af0c338240f94))
* **loot-filter:** describe the draft model and the editor target ([d101ae6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d101ae6148e56ea7225c0222f1b15e7472b7bd90))
* **loot-filter:** describe the library tabs, cards, profile and home blocks ([94fdef3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/94fdef3791a93f6d07da12947b03e7502f2a8924))
* **loot-filter:** document the editor routes, save flow, sandbox and update banners ([48679d9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/48679d9685a97ca89f1ad9edfba7b377121ce94b))
* **loot-filter:** document the review fixes to saving, updates and the library tab ([092396c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/092396c96178d41f9a8582ff8b8772607d163288))

### Refactoring

* **supabase:** move the keyset cursor and uuid helpers to core for reuse ([0da513f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0da513f6a3725c9d29bcb505441ca392019edb87))

### Tests

* **loot-filter:** add an API-level check script for the 005 loot filter migration ([1143599](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/1143599e7b9f2c23be799d97ca83290ad189cd6b))

## [1.47.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.46.1...v1.47.0) (2026-11-02)

### Features

* **loot-filter:** add check in game, scaled stat warnings and skip wrong-shaped rules ([58fab67](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/58fab67f25810574801d806f297bb8d320e5479f))
* **loot-filter:** add example rules and point new users to Sully's filter ([69c8c3e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/69c8c3e05f53b0695fd77d6f29c2e5f49f4052cf))
* **loot-filter:** let "except items with" own its rows and flag stat quirks in red ([e7dd53c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e7dd53c6903cb19bf24b28e504977072cde632cd))
* **loot-filter:** merge round 6 except rows, in-game check, examples and sully v0.6.11 ([092e2d2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/092e2d2e0240171d892ef576f57d52cae54052be))
* **loot-filter:** merge the affix text search, example rules and new user tips ([293181c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/293181c3bf54d19c74e71c034bc8d68a2e320041))
* **loot-filter:** merge the in-game check helper and scaled stat warnings ([7e93f5d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7e93f5d1dfc1b42a60362b298d63fab1431ef7d3))

### Bug Fixes

* **loot-filter:** find stats by affix text and mark percent attribute stats ([0ca9115](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0ca9115a04663d070764b5999da2934c6e7563c9))
* **loot-filter:** tighten the in-game check, wrong-shape skip and scaled stat warnings ([2c623e1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2c623e1af82f57813bc6d20f59e9b7c5ae669ee5))

### Documentation

* **loot-filter:** plan filter sharing and an LLM prompt start in the backlog ([129abbe](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/129abbefdcd020ed98abbfb6a611267403cdcaa6))

### Chores

* **loot-filter:** refresh the template to sully's qol filter v0.6.11 ([3b1335b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3b1335b1fa2266db28647b8edc62029ef02e9c56))

## [1.46.1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.46.0...v1.46.1) (2026-11-01)

### Bug Fixes

* **loot-filter:** merge the in-game test answers and the param picking fix ([579cf32](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/579cf326df9cbac7535d8247319ad35405f3c215))
* **loot-filter:** read a stat check without param as param 0, as verified in game ([919993e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/919993e1db4807a9e98efc6887a4303c6ec4a5f4))
* **loot-filter:** state the confirmed Enhanced Damage and Defense plugin limits ([6a93d92](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6a93d922c3979fd5521ea64d2575af8f6471219c))
* **loot-filter:** stop the affix browser pre-picking every param a broad search names ([afb5c2a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/afb5c2a9a8231ce3290095c8ac981c89723ac19f))

## [1.46.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.45.0...v1.46.0) (2026-10-31)

### Features

* **runewords:** fold per-jewel-count rows, put jewels first, add a Mythical Jewel note ([5b06fdd](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5b06fdd8a6a8749d5855d7e32dfeba9c59247de1))
* **runewords:** merge the rune icon socket row and jewel row folding (feat/runeword-card-icons) ([f79a0ad](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f79a0ad98fec29855f113d2b0ff50302da2856b2))
* **runewords:** show rune and gem icons in a socket row on runeword cards ([2b49c77](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2b49c77f566401930f25e1e455e583cf42f19169))

## [1.45.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.44.0...v1.45.0) (2026-10-31)

### Features

* **runewords:** order runewords by required level ([2aadf60](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2aadf60eface927217f966553bb2cb89abebe3af))

## [1.44.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.43.0...v1.44.0) (2026-10-31)

### Features

* **game-data:** skills and known layers in lootfilter.json, layers in affixes.json ([45ecfdd](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/45ecfddbb2228f7f938975619eb9c937a3917883))
* **game-data:** stat layer codec ([fd4d4aa](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fd4d4aaa257bc064fe0cce0bbd989d8409ad355d))
* **loot-filter:** param warnings and the omitted-param switch ([7e72e03](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7e72e037b24ccafa7e019c15c127d38bc098cbe9))
* **loot-filter:** pick params in the affix browser ([c102d6c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c102d6cc724d1949e09b17d12ada17d33e9c8d6a))
* **loot-filter:** skill, tab and class labels in summaries and search ([7f73aff](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7f73affedba28385e63b43299f251b56d55e92e5))
* **loot-filter:** skill, tab and class pickers on stat rows and in the Test tab ([1158320](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/1158320420a602f5d3bd910b027fed470db8a969))

### Bug Fixes

* **game-data:** func 10 skill tab from the slot val ([6147871](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6147871df307e1c1895c8f36690f0e81073fe785))
* **game-data:** set bonuses as sources of the loot filter's known layers ([8c6fe48](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8c6fe48bae115c3e747547428f6e932479cf02ac))
* **loot-filter:** keep class skills grouped by class in the skill stat pickers ([575c156](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/575c156e8d379ef75c84b4bdd08007a0683a52bf))
* **loot-filter:** let a picked stat param be removed again ([4df0454](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4df045483fc86ec7513bb62fdf917613ab698228))
* **loot-filter:** one likely-mismatch warning per list of properties.txt tab numbers ([c70cf7d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c70cf7de328e74adfed6d407eab1c9f655829203))
* **loot-filter:** show every picked param in the affix browser ([7752d19](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7752d19953d97c3f67546b9c5193deff88d91a97))

### Documentation

* **loot-filter:** record the formula and show preview with the open questions ([7173054](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/717305424718138d9a58895b0c4f52a6920fe2c7))
* **loot-filter:** skill, tab and class params ([e23c8fd](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e23c8fd6d8bb29146589a74c799b95327b909f3a))

### Chores

* **loot-filter:** refresh the template to sully's qol filter v0.6.7 ([eebd0e7](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/eebd0e770eca2359e2410b9e4e5fa06506142e4d))

## [1.43.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.42.1...v1.43.0) (2026-10-31)

### Features

* **loot-filter:** add a hide-only tip to "How rules combine" ([ad98e02](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ad98e025d56bcc61cb7767607404960f457e42d4))
* **loot-filter:** add an "Except items with…" control to hide rules ([5ee9237](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5ee923739eb18b3cc1447d44d89e4f0689969d0d))
* **loot-filter:** label the stat lists as item and character stats, all of / any of ([a720f13](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a720f1357322cde8921e2d05111c94852aff46de))
* **loot-filter:** leave coupon uniques out of the unique and set browser ([b65d275](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b65d2752aac2ebb68928bb4b18409bd6ceaa9a1a))
* **loot-filter:** warn about item stats the plugin reads as 0 ([8a326b8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8a326b8f16de7541bbe696eed6d2775ecb23bc25))

### Bug Fixes

* **loot-filter:** drop the filter-wide disabled-rules warning ([e04f78a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e04f78ab171b0ed9c9e0a2e540b89c3951375b8c))
* **loot-filter:** keep exception checks out of the plain affix browser ([ab85692](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ab8569280ad3022bc31b1bcdd4f984361575bb49))
* **loot-filter:** keep the hide-only tip to what the guide states ([0351d5e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0351d5e856953684964701a862b8c644103c0848))
* **loot-filter:** read exceptions only where they keep items ([9aa2261](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9aa2261a80ba7ea88b5b5cb41cb04718a559dc01))
* **loot-filter:** say Enhanced Damage should still work on jewels and charms ([2f0c140](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2f0c1405ff39d8a0589dc876d89874179fc3f22b))

## [1.42.1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.42.0...v1.42.1) (2026-10-27)

### Chores

* **esr-update:** cover areas, loot-filter ids, cube fallbacks, the template and the Frame Table ([5228669](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5228669e0a6877f1ce144cf40924f7d9bd21aded))
* **loot-filter:** refresh the template to sully's qol filter v0.6.3 ([633c518](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/633c518397ce533e24050fd0f294b82f27aca0ed))

## [1.42.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.41.2...v1.42.0) (2026-10-27)

### Features

* **builds:** draw the skill tree like the Skills page ([5ac3fc2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5ac3fc20e5217ee55869e52a6312d8850df921a0))
* **builds:** merge the icon skill tree (feat/build-skill-tree-icons) ([23ea43a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/23ea43a90917bbb7517f0a57df9b27c13e5b4f15))

## [1.41.2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.41.1...v1.41.2) (2026-10-27)

### Chores

* **loot-filter:** refresh the template to sully's qol filter v0.6.2 ([07da354](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/07da3549e48d126a812722a75cb3ff1bbbf131a2))

## [1.41.1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.41.0...v1.41.1) (2026-10-26)

### Documentation

* note Vite 8 and Vitest 5 in the tech stack ([641686f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/641686ffd0773b76c958f91e3fb1c7abe199f223))

### Chores

* **deps:** apply in-range updates and drop eslint-plugin-react-compiler ([88dd1e9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/88dd1e9cd5c39772e3218f04570c04f69c0a5011))
* **deps:** upgrade commitlint 21, commit-and-tag-version 13, jsdom 29 ([ddbe778](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ddbe778b49abf350918c4606acea9aa4f6fb1693))
* **deps:** upgrade to ESLint 10 and eslint-plugin-react-x/dom 5 ([01c3860](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/01c3860ea1f963018eac2c08538adbe5dff57001))
* **deps:** upgrade to Vite 8, @vitejs/plugin-react 6 and Vitest 5 ([ae457ed](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ae457ed8c502ad1d8273b89794b0f5ef2a4171aa))

### Build

* move to Node 24 LTS ([7d78fb2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7d78fb21e8eea3bdecf090e55f05dfe166fa2d9d))
* project npm config for npm 12 ([6687c4f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6687c4f5b393d7b6a5c294f4b3ead7156e99cc9f))

### CI

* bump checkout and setup-node to v7, read Node from .nvmrc ([af65dea](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/af65deac064451ee1e72ce7bf1b8abb59d0df587))

## [1.41.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.40.0...v1.41.0) (2026-10-26)


### Features

* **game-data:** list the item stats each affix writes in affixes.json ([88984ee](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/88984ee047ce52d99ec9802bef23beac2e5bebfe))
* **loot-filter:** browse affixes to add item stat checks ([3332c05](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3332c052d25f03b2a14a9408cd29a4e86cad9dec))
* **loot-filter:** model the affix browser rows from the affix stats ([ba0697d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ba0697dfec770939f1ed4e00856a22740e65a575))


### Documentation

* **loot-filter:** document the affix browser ([4aceb07](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4aceb07c424ae60ebad186447821778f5876bcd5))

## [1.40.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.39.0...v1.40.0) (2026-10-26)


### Features

* **game-data:** add required level, set name and disabled flag to the loot-filter uniques and sets ([b9d7efa](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b9d7efa5c0f473ea3752d6ef5f4cb82f4ff77e02))
* **loot-filter:** add a browse uniques and sets dialog to the unique and set pickers ([1be131d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/1be131d32b0167f6f974a3e53b92b3e17e417f57))
* **loot-filter:** build the unique and set browser model ([8251fc2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8251fc2f05f9b5c3e7a9a42a0ecc62f51ba5412f))


### Documentation

* **loot-filter:** describe the unique and set browser ([37a8f41](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/37a8f417908d95bca997eb65014e7cf5a64aee09))
* **loot-filter:** format the backlog ([12293d7](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/12293d79eb23023ff7531d78f8a58f1d848645f3))


### Refactoring

* **loot-filter:** share the browser tabs, add merged, disabled and column-list cells ([647d1e9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/647d1e9c17a455bdc819794d18859b1b45717511))

## [1.39.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.38.0...v1.39.0) (2026-10-26)


### Features

* **loot-filter:** disable and enable rules from the rule list and editor ([0ad8a4f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0ad8a4f405e02f2bccdf0f9cbd44caa81f4f1c66))
* **loot-filter:** explain in the rule editor that hide-if-fail also hides other qualities ([da17d86](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/da17d86c5626b5216676425c22aff75f784523da))
* **loot-filter:** keep disabled rules in a top-level disabledRules list ([b06ca10](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b06ca10faf432f2def1714e95e1147dc9c02eb0c))
* **loot-filter:** warn about hide-if-fail pitfalls and empty condition lists ([281b9de](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/281b9de989e7ecf63709c7ecb3e301485e82ba80))


### Documentation

* **loot-filter:** document disabledRules, the new rule warnings and the hide-if-fail note ([ba5ade4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ba5ade4e04e0d18ad28d9097d5492cdef36a0837))

## [1.38.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.37.0...v1.38.0) (2026-10-26)


### Features

* **loot-filter:** bundle the twelve minimap icons of sully's qol filter ([aeebc04](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/aeebc04bcbfc655d8959f8612908659565a16be6))
* **loot-filter:** start from sully's live qol filter instead of the old esr default filter ([aefbb36](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/aefbb36320bd5a65d9508cf7115b3eac0623e25d))


### Documentation

* **loot-filter:** describe sully's qol filter template and the bundled icons ([ce6b07a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ce6b07ad2771a080fc6f56a2242b190b5a3fde45))


### Chores

* **loot-filter:** update the template comment note ([9316fe0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9316fe08e608cf14586759a541e73642f4430a52))

## [1.37.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.36.0...v1.37.0) (2026-10-26)


### Features

* **game-data:** mark runes without a gems.txt row as never dropping ([e054875](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e05487540f27cb8fb452876b4bd7ecb5e090441e))
* **game-data:** mark which loot-filter items can drop ([ec2f3ce](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ec2f3ce3c53712ca0e46d4e4f2fbb607c1bb7ab2))
* **loot-filter:** accept block comments and trailing commas when reading filters ([da78a9d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/da78a9d12ad1b0c0b3ca6cb53ef25ea1e4e692bc))
* **loot-filter:** list misc items that drop and label items that never drop ([00711d2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/00711d24cfbe4f2604b2679b15467dfec9e27009))
* **loot-filter:** warn about accepted trailing commas, block comments and dropped section comments ([dea0a2f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/dea0a2f3b86e8d7c8c9631f12e7589d76e5076db))


### Bug Fixes

* **loot-filter:** add the code only to labels of unmuted items sharing a name ([0c2296c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0c2296c0ddc987c77887e7703a9f3195538779d4))


### Documentation

* link the loot filter backlog from the docs index ([38d1660](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/38d16603d626b9d591fe1ff1f4a10c57c47ef435))
* **loot-filter:** add the backlog of deferred loot filter items ([81653b0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/81653b0fe6c8d9d5e87ef8f06f97652dba5742cf))
* **loot-filter:** describe the lenient reader and the text notes ([f2495cf](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f2495cfdfb237ced1169b59bb4d26d69247b5ab8))
* **loot-filter:** document the drops flag, never-drop labels and coded duplicate names ([b558d4c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b558d4c6f9d8d30badba373e8915f8e2a9f1d109))

## [1.36.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.35.0...v1.36.0) (2026-10-26)


### Features

* **home:** search skills, materials, areas and cube recipe families ([d755671](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d755671736bbb54e4560c6d18ab224e93268a698))

## [1.35.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.34.0...v1.35.0) (2026-10-26)


### Features

* **areas:** area levels page from levels.txt with map tiers ([f855f38](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f855f383b760d637dc93fc4de233ac310e71c8b4))
* **areas:** merge the area levels page and register its route in the sitemap ([3661058](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/36610589eeeb27d26de5b81aa8df17a1f8f27c1f))
* **cube:** output item level, more conditions, input/output search and quality filter ([ccb3032](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ccb3032414a70654d5795ed168cebc028f9aea69))
* **guide:** link the official Frame Table ([2e55587](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2e555872434cad3044f4976f2ecc8348ab8c6da2))
* **nav:** add the Frame Table to the official ESR links and rename the Items menu to Database ([08de261](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/08de26173869ba5f82d33aba84573cf3cf02ff7e))


### Bug Fixes

* **areas:** read vanilla unique-pack rows stored mins then maxes ([a83cbd6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a83cbd6a78287a74e9662ed51685289afcc494fd))
* **cube:** show the mythical description lines a recipe adds ([7ae97d5](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7ae97d5f5bd2e35ece0191bdd9502d8ee926571a))


### Documentation

* **areas:** unique-pack rows are ESR data, not vanilla; note the duplicated level names ([0559069](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0559069b73cb5cfbf5061899cc7a7524f0e173d5))

## [1.34.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.33.0...v1.34.0) (2026-10-26)


### Features

* **home:** community tools section and links in the header menu ([2212c2d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2212c2d21bb392cfe70d28fb843102c8a193da83))
* **home:** official ESR links section shared with the header menu ([6941294](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/694129457ecccfbdc2cb30210e8a9a926cbb84b3))


### Chores

* **esr-update:** cover icons, skills, tiers and the docs version source ([4ce7803](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4ce7803e7a4939a7169d0ce01227e47d144e6533))

## [1.33.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.32.0...v1.33.0) (2026-10-25)


### Features

* **game-data:** base tier badges on unique items and sets ([ddd0552](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ddd05523b2c629537b28dec2c74209bebc592572))
* **skills:** skills page with class trees and item-granted skills ([7d7e866](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7d7e8667cad323a77a7f96e244bca6a81a17f3c3))
* **ui:** shared page shell, filter panel and filter group ([d7a3fde](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d7a3fde60e8926991ea36c2b0cdf10f0e138f655))


### Bug Fixes

* **data-sync:** read the ESR version from the launcher metadata ([7feae14](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7feae14e1e9f3b44c99675f42ec71946a669280f))

## [1.32.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.31.0...v1.32.0) (2026-10-25)


### Features

* **game-data:** item icons for set items, uniques and builds ([b0533fc](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b0533fc12aa328b431aaff415e601070d9acfef1))
* **game-data:** item icons on the Bases page (prototype) ([08e58ff](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/08e58ff66ac6bf46393b8fb44bdbe221f5f5f975))
* **game-data:** recolour set and unique icons like the game ([dd34467](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/dd344672b4f7268bd5aca71ebb06be2623fea32f))
* **game-data:** socketable icons on the Socketables page ([6b8de3e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6b8de3e2738f2370943de65322d17efd4aaee2ea))
* **game-data:** vanilla D2R art as the second icon source ([d3f39e8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d3f39e8f1cff067a72583839e7a052b1c176fceb))

## [1.31.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.30.0...v1.31.0) (2026-10-25)


### Features

* **game-data:** families view on the Bases page ([85319cd](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/85319cda2cd1b4f66ceb4a8b3f9fb4a42127d0b8))

## [1.30.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.29.0...v1.30.0) (2026-10-25)


### Features

* **builds:** clear shortcut on each skill cell ([0a6f28c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0a6f28ce4dead2e04217440658a4cec185cd6cf2))
* **builds:** max-points shortcut on each skill cell ([ab61d72](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ab61d72811f51c5202625c70632022ec08f6a05b))


### Bug Fixes

* **builds:** offer only the bases that belong in the slot ([0fb704e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0fb704e42bb578fa6a567dd4c0edf8b2b5c24908))

## [1.29.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.28.0...v1.29.0) (2026-10-25)


### Features

* **builds:** choose a runeword base and record socket fillers ([d432a13](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d432a1305c7e90a85b74c61c58c7bc093e4dd150))
* **builds:** player level and a structured skill tree ([040f055](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/040f055a21c818f1b015533cf67eb2d4256de377))
* **builds:** structured crafting annotations on equipped items ([e4d1e77](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e4d1e77d7b79c1b8a9b7cdb31aaba92d244bca93))
* **game-data:** add the skills and crafting option bundles ([7079945](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/707994502b5c9276b03a4afcf8db418f5e5488d0))

## [1.28.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.27.0...v1.28.0) (2026-10-25)


### Features

* **builds:** equip set items and show the active set bonuses ([9f0c20f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9f0c20f2cdab6663f6767ec66ddec0abbd8104c0))
* **game-data:** add the Sets reference page ([008996a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/008996a3228ce6703b24be8d5768da36853c6e6e))


### Bug Fixes

* **game-data:** skip Expansion marker rows whose comment column is set ([9736f1c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9736f1c1d22e00381a8d87f977182c6b27286a28))
* **home:** drop the icons from the section cards ([18617af](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/18617afc67da99771d3f8ddf9a1ac47766592698))


### Tests

* **data-sync:** follow the official docs wording in the HTM fixture tests ([a8d3489](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a8d348934f3a11a11ffa8b33a0778275a509cb50))

## [1.27.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.26.0...v1.27.0) (2026-10-24)


### Features

* **game-data:** add the Cube Recipes reference page ([fd6bdc1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fd6bdc1ad8a39f27c3bd98053803ec4cfe33e0f6))
* **game-data:** add the Materials index page ([1ffe7fd](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/1ffe7fd4b035ed1c2c1edaff36e14b132516211f))

## [1.26.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.25.0...v1.26.0) (2026-10-24)


### Features

* **home:** add a home page and move the runewords browser to /runewords ([b0cf5f7](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b0cf5f75d95e945d1404674765c8755006256683))

## [1.25.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.24.0...v1.25.0) (2026-10-24)


### Features

* **game-data:** add the Enhance page with corruption, anointment and Vessel outcomes ([5523adc](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5523adc489b5a6d2e9e58f1b40ebfbd7f47a13ec))
* **game-data:** show automod lines, staffmods, range and durability on base cards ([2fce8ab](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2fce8abd05d00b5e85b5f41266436c6d4f5206d6))

## [1.24.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.23.1...v1.24.0) (2026-10-24)


### Features

* **builds:** filter the slot picker by slot and tab the detail page ([49900d4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/49900d499106e28b557cc79692db3839dc3efe0d))
* **filters:** acquisition chips on uniques, max level on mythicals, any-rune mode ([3d09274](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3d0927492ec2d96077e8ce80ece25889f6a75168))
* **guide:** add entry cards and an official reference strip to the spine ([1e3ef96](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/1e3ef9660731b19d949c4a1eab53d2bf0b114105))
* **nav:** group the header into Recipes, Items and Tools menus ([e459a7c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e459a7cc7be9651035c6af420492e77bd0355c47))

## [1.23.1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.23.0...v1.23.1) (2026-10-24)


### Bug Fixes

* **router:** wait for the builds saga before mounting builds screens ([ab54706](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ab54706528218fd5be1830be289791226701e92e))


### Documentation

* **privacy:** disclose Cloudflare Web Analytics and scope the policy to this deployment ([99f8757](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/99f8757dd5c74f16d1bce03176ca37d92f2219e2))
* refresh the route tables and generate the sitemap from the guide build ([e9537f8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e9537f85b4a9fae0ca2a95e60e6f6c6cb9ad727e))
* **research:** analyse the d2r.dpdns.org fork and what to adopt from it ([0264e6e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0264e6e5ccc41d9e2e69c64d629146c08e990424))

## [1.23.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.22.0...v1.23.0) (2026-10-21)


### Features

* **loot-filter:** browse misc items by group and quality in the item pickers ([44ff22d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/44ff22d62c64209f1b29ed3ad10dd912a796b843))


### Documentation

* **loot-filter:** describe the item browser ([3f32c88](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3f32c88c91ccf6eb2c5b3a3cfe1093404b2330a1))


### Refactoring

* **loot-filter:** drop the unused countItems helper ([054b92b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/054b92bcac976b072edff88b44d9edd08f5fdda7))
* **loot-filter:** generalise the browser model to named columns ([637b247](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/637b247b87785312bae69a822b6cbc7c664dab10))

## [1.22.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.21.1...v1.22.0) (2026-10-21)


### Features

* **loot-filter:** browse bases by type and tier in the item pickers ([91088c4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/91088c4192bb00bba7572ee12703093f8a1928b0))


### Bug Fixes

* **game-data:** keep the Primordial Soulstone labelled as an Endgame Map drop ([007b68d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/007b68d54d262bee5f991ef19335f125d78d5da4))
* **loot-filter:** keep gloves out of the "helm" item search ([73ba0bc](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/73ba0bcb711c1770c2a9f139ced9b6b7b733c508))
* **loot-filter:** test items with the base tier of their base ([0f00038](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0f00038d8370da236954b8eb630e0d06fc907f22))


### Documentation

* **guide:** follow the 3.2.21 to 3.2.24 patch notes and docs for ESR 3.2.24 ([4b96fa0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4b96fa0588b428235d0caa25461c00bfbbe1f6b1))
* **loot-filter:** describe the base browser ([f9d0bc3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f9d0bc36e7e5f6df362e1e0c85e73e772c670e19))
* **loot-filter:** note that ESR 3.2.22 removed the stock filter from the mod ([c3df58a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c3df58abf7d85e050f6edd76ae1caac0faaacf6b))


### Chores

* **game-data:** update to ESR 3.2.24 ([5917465](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5917465125cd1e2204f595cafbc537847892bbe1))

## [1.21.1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.21.0...v1.21.1) (2026-10-14)


### Bug Fixes

* **router:** reload once when a chunk from a previous deploy fails to load ([4e1ce8c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4e1ce8cc46906c566847227cefbf89d3e2f4673a))

## [1.21.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.20.0...v1.21.0) (2026-10-14)


### Features

* **game-data:** carry the bases' second item type in the loot-filter bundle ([7a3a7c6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7a3a7c6ee33914119a037c409e5cc15e81e07e41))
* **loot-filter:** download a zip with the filter's sounds and icons ([0ec925d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0ec925dd0dfb923372d1e4d6aa2c189da4ea2791))
* **loot-filter:** find items by type and add or remove every match at once ([0f9744d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0f9744d305369dc984b86e8b0e845191d95ccb53))
* **loot-filter:** warn about rules that can never match and explain how rules combine ([75b0755](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/75b0755bbc0e95a8bc01801242111ebfee319717))


### Bug Fixes

* **loot-filter:** default the minimap icon to 50 px and explain sounds.txt ([2e76fd7](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2e76fd77cf01db5e272fb8b6ebd17c4dd6138c2c))
* **loot-filter:** keep the picker open, in place and on its search after a pick ([9ae4ecf](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9ae4ecf878b7f228f371e3eccbca3b0bbd4b94af))


### Documentation

* **guide:** follow the 3.2.13 to 3.2.20 patch notes for ESR 3.2.20 ([8bf50e0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8bf50e06bd656b12839e8ae4d10b6f7c1a9bb999))
* **guide:** say where the five elemental orbs for the Orb of Creation drop ([bebda37](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/bebda37211bbf281fb1c484df848d5fa704256b4))
* **loot-filter:** transcribe the 3.2.20 guide and describe the feedback changes ([e0f897c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e0f897caa5ed8487efd5d6b5747082f4e8242365))


### Chores

* **game-data:** update to ESR 3.2.20 ([e0039f8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e0039f81809d76c7a4b3f729b51363a2dcb7adc6))
* **loot-filter:** bundle the ESR default filter in place of Sully's QoL ([f195c6a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f195c6a9644b125e2762da836210cf2a4b13e8d7))

## [1.20.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.19.0...v1.20.0) (2026-10-11)


### Features

* **guide:** add thirteen recipe families so more notes show recipes from data ([59f0dbe](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/59f0dbeb2a90d73c666ed3273400095140cebbaa))
* **guide:** show the bonus a cube recipe gives in the recipe blocks ([601592b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/601592bdf2ab9ef53c07e481a3b88d713942fd3f))


### Documentation

* **esr-update:** cover the launcher sources, Drop Finder and generic recipe blocks ([e45975c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e45975c05a1a4776d5d47235c40fe72af582bdf4))

## [1.19.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.18.0...v1.19.0) (2026-10-11)


### Features

* **guide:** add the /guide/map page with a full graph and a grouped list ([39ebe6d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/39ebe6db2cbdab7dd0b04304e0a0c016603eca20))
* **guide:** link items to the official Drop Finder ([6c9f5d4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6c9f5d41ac1049be3b9760916cfe7b6ffaeb96f7))


### Bug Fixes

* **guide:** correct the notes against the 3.2.12 game files ([98a0078](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/98a0078bc700d26e3e6913cf0008954f8a4f32c5))


### Documentation

* **guide:** describe the map page, Drop Finder links and new recipe families ([9c5366f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9c5366fa1c39bfa58d8441c9f1afa73c068cceaa))

## [1.18.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.17.0...v1.18.0) (2026-10-11)


### Features

* **game-data:** add the lootfilter.json reference bundle ([be53091](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/be530915dfd0c9d767d8aedca1c24920491fbb17))
* **loot-filter:** add the filter engine, the author's guide and the bundled template assets ([06d7d49](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/06d7d49324a40e3f6d4579255cfa72431adc52fe))
* **loot-filter:** add the filter library, routes, editor shell, settings and JSON tabs ([88e35b8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/88e35b84b213a3a39adae1dc11f0ef78ee93bb99))
* **loot-filter:** add the rule builder, the actions editor, the Styles tab and previews ([5601150](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5601150d06806c8fb8b681b85ce3009232ea5d7b))
* **loot-filter:** add the test-item tab ([f8a41eb](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f8a41ebe76d117bed10f3cc7cdc90352be5db405))
* **loot-filter:** show an "Under development" notice on every loot-filter page ([28ed8df](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/28ed8df14102c6fc9abc76186ed21a882bd8dcff))


### Documentation

* describe the finished loot filter feature in the docs index ([d349e9a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d349e9ab53d276ea846ac9f325c982b8e25b8ca7))
* **loot-filter:** add a resume checklist for picking the feature up later ([3853d26](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3853d267dbe313004092126a5b96e12eedd79663))
* **loot-filter:** add the D2RLAN guide and engine findings and the Lua to JSON mapping ([c0ded96](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c0ded96ba6575d1df35bc76267894ec6187d23b4))
* **loot-filter:** record the guide's answers and the updated decisions ([e1ed4df](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e1ed4df91de67b259aa48bcb5f5c4c847b290ad2))
* **loot-filter:** research notes, decisions and questions for the mod author ([cf9a1f5](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/cf9a1f54d1c3d299a4210b2d969bae30dcdfc0c5))


### Chores

* **loot-filter:** add the ActionsEditor contract stub ([fb5673b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fb5673b42ed356328bf145f6487a1b1fe05114a4))
* **loot-filter:** justify the index keys in LabelPreview ([00632db](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/00632db2eb1df2b58640006acd9750551b3d187a))


### Refactoring

* **loot-filter:** apply the code-quality review findings ([6693b4b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6693b4be68c4a5bc277661f70214cc11c0a3a7af))

## [1.17.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.16.0...v1.17.0) (2026-10-11)


### Features

* **runewords:** accept a socket range in the sockets filter ([3d1612a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3d1612a6bbde7b2e763141a5a5e447a65d020654))


### Bug Fixes

* **guide:** describe Merc Only Conversion as a life drain, not a Vitality penalty ([7a908b6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7a908b68fc588a26bd7062a8c6a2e2913b25e8c8))

## [1.16.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.15.0...v1.16.0) (2026-10-10)


### Features

* **game-data:** add sources bundle (where an item comes from) and regenerate for ESR 3.2.12 ([a113af5](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a113af51bd86ba4ade7bf712865813b99cbb1d9b))
* **guide:** add the embedded card block type to the bundle schema ([4311899](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/43118991244933ee2d9e7a6d6a967e642c3cccfa))
* **guide:** add the first 24 guide notes and the generated bundle ([0d13d3d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0d13d3de8a27fe6dbbd47f856468978c807784fc))
* **guide:** add the guide content pipeline (markdown notes to public/guide JSON) ([3a5c3b8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3a5c3b89e757fceb6aad9acfe7a35ffc1bb34265))
* **guide:** add the guide contract, bundle schema, loader and freshness helper ([7554b17](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7554b175c3e23d20e1f0caa50268e1818a8af85f))
* **guide:** add the Guide screens, routes and header entry ([9d48501](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9d4850166dd2a8450d00631fd2eaf69bfc9273ca))
* **guide:** local graph, visited notes and staleness tracking ([7bcb926](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7bcb926c091fcf8464a5cddb61a419312eac632f))
* **guide:** reading panel with softer text on note pages ([b0bac6d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b0bac6df5e9df71e54da894efe10c5d3dc6d165c))
* **guide:** recipe families, embedded item cards and seven more notes ([7ebf80e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7ebf80edf30d307ed886dd24ce283edfda4bbe35))
* **guide:** show an "Experimental" notice on every guide page ([0aca673](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0aca673ce748535a3a5e5e22d22dc3b82631a530))
* **items:** exact-name deep links and source lines on item cards ([b84e82d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b84e82d3d7de53843521859c964a330c467098de))
* **tooling:** add the /esr-update skill and an ESR release-diff script ([c76c969](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c76c969e5bc42a29d0913adf75ed84c3ec1c0535))


### Bug Fixes

* **guide:** address phase 2 review and QA findings ([210ea8e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/210ea8e1420e8e283a1a07b7f3065dc179057d83))
* **guide:** address phase 3 review and QA findings ([b44d271](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b44d271bc859bb84d295aa84f38605b893301795))
* **guide:** address review and QA findings ([079ff29](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/079ff29cd4c58383c909c8a950390a6dcc0e8876))


### Documentation

* **guide:** add research and brainstorm synthesis for a new-player guide ([624ed0e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/624ed0e1f623333e7d4895b621e1767cdceda678))
* **guide:** link the guide spec from the docs index and mark the research as implemented ([833b3aa](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/833b3aa697ecc7d68fa52001004608354f641902))
* **guide:** note the escaped pipe for wikilinks inside table cells ([0742db8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0742db8970517d7c3223759aa6ad033cab810309))
* **guide:** record owner decisions on the guide feature ([5939e11](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5939e112570329997ae722d7a64f7bcfec66db5b))


### Refactoring

* **guide:** apply code-quality review findings ([0c04329](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0c0432951d30c6feedd5fa83bf1b66f4408f1921))

## [1.15.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.14.0...v1.15.0) (2026-10-09)


### Features

* **game-data:** add Game Data section built from the ESR txt game files ([37d8a30](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/37d8a30f1c1815821b1be7201f6d0b6654342d49))
* **game-data:** add one-shot game-data:update script for ESR releases ([a104a3f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a104a3f71855354d976d614f54f36577ef1e5e61))

## [1.14.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.13.0...v1.14.0) (2026-10-06)


### Features

* **builds:** add Warlock class ([f23aed7](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f23aed701d56cb007ce049d1f51312a1cc05e210))
* **gemwords:** include random bonus pool lines in text search ([72fe42f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/72fe42fb273cc1655ae54464f013bdd29aee1f97))
* **gemwords:** parse random bonus pools ([bc85eff](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/bc85eff556bcf0c56f12b446aa5b113beb59f7ad))
* **gemwords:** show random bonus pools on cards ([25e06f0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/25e06f0091fba0c6e067108fa951e7b22f1804b5))


### Bug Fixes

* **data-sync:** detect Kanji runes after ESR 3.2 colour change ([f3c8c9a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f3c8c9a84041dfdc5d906aa33a570be40d2780e8)), closes [#EED68](https://github.com/istvan-panczel/d2r-esr-runeword-browser/issues/EED68)
* **data-sync:** parse ascendancy tier labels with a footnote marker ([fbca3a3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fbca3a35016b2be8c77c611aaaa31493fe9c6c2b))
* **data-sync:** parse required-jewel runeword rows added in ESR 3.2 ([882c61d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/882c61d5a6a29ba75935232c88c6ce027683ad19))
* **data-sync:** skip verbatim duplicate gemword rows ([742a842](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/742a842d08b502a003d7f19adc214903296a14b2))
* **runewords:** classify renamed two-handed melee weapon type ([7921384](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/79213849e8c1ace9d2ce073074c73261a0f49d38))
* **unique-items:** group ESR 3.2 unique item categories ([0e45144](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0e4514423ce85a8455dd2a7fe357376dae18ce05))


### Documentation

* **data-sync:** note the unparsed ESR 3.2 gemword bonus pools ([eb592a5](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/eb592a5480fa6d17cb670cf5adf41ca3654d8d0e))


### Tests

* **api:** expect ESR 3.2.02 as the newest changelog version ([d72ee3f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d72ee3f9219ff5f829ef6f309374f6a0cca9d6f7))
* **data-sync:** align gemword expectations with ESR 3.2 ([7c931a3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7c931a3c11fe08158312e86c30fbd240f37087a2))
* **data-sync:** align unique item expectations with ESR 3.2 ([5f6fad3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5f6fad3b055b98ebc0fd53f3c0b78ee170ed997b))

## [1.13.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.12.1...v1.13.0) (2026-10-05)


### Features

* **router:** add a not-found route ([3538561](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/353856110d5de432ed43f6000cf8992e611698ac))


### Bug Fixes

* **a11y:** label settings drawer controls and use warning token ([64deb40](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/64deb40d49ad8d0db33be81b2a0f828ee60bc5ed))
* **a11y:** make rune/gem badges focusable and label tier point inputs ([1a0bc3b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/1a0bc3b93dd78db45729efcdcafc69a1adb3c79e))
* **auth:** only restore same-origin app paths after sign-in ([c72a0b6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c72a0b636a1942d7656f943bbd854afdcc7ead66))
* **auth:** retry consent with a fresh discriminator on name tag collision ([be9f540](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/be9f5408c63adfe53d40dd8272c8907372dcff20))
* **builds:** add accessible names and states to build controls ([e4d2694](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e4d269493b097e0763e9947303d91bb96d6bbb26))
* **builds:** stop load-more retry loops, stale pages and list over-fetch ([1ca0748](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/1ca07485d2d6fa303ad541286b50405f363a17ef))
* **builds:** validate item refs read from build_data ([0561ed8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0561ed8aa9dfb4ac524758a64d78ae1be077060d))
* **data-sync:** warn when a forced refresh fails ([42f08fa](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/42f08fa50444041e1b08a24c6700e849fac34cfe))
* **db:** recover from an un-upgradable cache database ([3cda76f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3cda76ffec588694c042b4318c2b733f203c098b))
* **runewords:** reuse parser LoD sort-key offset and let long card titles wrap ([c6174f8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c6174f8b59aebafe9e0c06c338343e6977fd637d))
* **settings:** apply persisted theme before first paint ([4c76b79](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4c76b7938dc6f224186f426bb140c1bf23045355))
* show toast on clipboard failure and clear copy-reset timer on unmount ([fb92c4a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fb92c4a9bc696c1119d7607be34efc54d37c3336))
* **socketables:** explain the empty list when no categories are selected ([73eb555](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/73eb555326465028ab4971d5fe674588af6ca159))
* **theme:** add warning colour tokens ([7f7675d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7f7675d8a76c03188987df96e7b44a9048175806))
* **ui:** keep unique card headers from overflowing on narrow screens ([dee09ed](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/dee09ed007843497556de3e61f8cb25465b1f949))


### Performance

* **runewords:** load rune and gem tables once per screen for badges ([beed142](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/beed142bc99c542697e6140dde071e8539c31089))


### Documentation

* align documentation with the current code ([af71659](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/af716594f47a6abe01a93f2b18c459944ba91b8f))
* **builds:** document load-more errors, list select and name-based item lookup ([c2e4403](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c2e4403fdbf53aa483d33acaf4f00b86d68c38bc))
* describe public likes, favourites and avatars; refresh backend wording ([8c0a1e0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8c0a1e0efcec988bcd69aff82fd58abb01b161a1))


### Styles

* format ScrollToTopButton with prettier ([7a1f313](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7a1f3136600fc877cb6a038b1587d21e44ce639f))


### Chores

* **deps:** bump react-router-dom, move build tools to devDependencies, drop uuid ([8e6a68a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8e6a68ace5b2ac7e570a98ad98fd560a21a4792b))


### Refactoring

* **core:** remove unused tsvParser ([370dd48](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/370dd48cf9e4f22d74c256ca027ad6166e009ad4))
* **core:** trim supabase barrel and align write types with grants ([e572a21](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e572a2182df209a41f79997434c06a78c076487b))
* **data-sync:** drop test-only exports ([107f2a1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/107f2a1aaf3cf690f30cd02eb9f6bf60930b6bcc))
* **data-sync:** remove the unused affix extraction step ([65f00ba](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/65f00baa0b2313f8158327db785dd52ad9dbc3c9))
* **filters:** use useDebouncedFilterValue in socketable, ascendancy and unique filters ([4b67bff](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4b67bff6dbc29dc8172128dc93485259e068f4b3))
* **router:** clear consumed URL params through react-router ([305ea61](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/305ea619c1b05a06dabff5f4b6044b4ba6a4dc00))
* **runewords:** remove unused barrels and test-only sort helpers ([17284a1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/17284a114aad2fd49199232d73f6856b8d2d7fa9))
* **runewords:** share column-difference check and bonus sections ([b1eb91b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b1eb91b6850679634bb2293e4a224d7f5bed9bae))
* **runewords:** share recipe search/sockets/level filters with gemwords ([d9034e0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d9034e0eead55fc187b09d33d06fd35cc2cccd3d))
* **share:** build socketable, ascendancy and unique share URLs with shared helpers ([59e16f2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/59e16f223ff2f817341f1e847883f89bd3a2f206))
* **uniques:** share category selection helpers between unique slices ([ee9c37a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ee9c37a5760c40e81d80981f1bd69f5d79b506e9))

## [1.12.1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.12.0...v1.12.1) (2026-10-05)


### Bug Fixes

* ignore property line re-wrapping when diffing build snapshots ([e531ac8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e531ac807340f4badd7696e222a2f33c7133aa7a))
* keep cached data when freshly parsed datasets look implausible ([e7c190c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e7c190c994df82ab2ef74a134b0dffed481a3828))
* re-join hard-wrapped affixes and classify multi-line mythical specials ([1f545cb](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/1f545cb3ad2088d1bcaa0116fe7030860971dc09))

## [1.12.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.11.2...v1.12.0) (2026-10-05)


### Features

* distinguish same-name unique variants in equipment picker ([08f6df4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/08f6df4cb4c45ce54331b95d9fe26c7e0acc43f4))


### Bug Fixes

* fall back to cached data when parsing or storing fresh data fails ([33dad64](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/33dad64644f379efee02df2623930ce289adc4c6))
* handle none-selected marker when toggling unique item categories ([ebd4fa2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ebd4fa24cd30a1e7830a814e3e702e11149ee06a))
* match runewords with socket ranges in socket filter ([524ac62](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/524ac62b075dbca16451d40502938ef8ee765ddd))
* resolve same-name unique variants by saved snapshot stats ([74dce05](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/74dce057295a7fc624587de579031c3622949637))
* retry discriminator on collision when creating new user profiles ([c8efafa](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c8efafac403b77e2c275027997cef5ccca0e0719))

## [1.11.2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.11.1...v1.11.2) (2026-07-30)


### Bug Fixes

* adapt parsers to ESR 3.12 HTML format changes ([29e6bc0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/29e6bc0e75f7ca5106c6724589a3e8441802318d))

## [1.11.1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.11.0...v1.11.1) (2026-06-09)


### Bug Fixes

* fix unique lookup in builds ([e28da0d](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e28da0d850fca38816b0afad3d93f6b206154664))

## [1.11.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.10.1...v1.11.0) (2026-06-08)


### Features

* build sharing with Supabase backend ([2831af0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2831af0ae1b92b293c23f247f1b2511e463ca1d8))
* **favorites:** move runeword/gemword/unique favourites to Supabase ([64e5f4c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/64e5f4ce5030f8e52b7927bf6c58ae58819283b9))
* **nav:** collapse overflowing header links into a More menu ([8ad048b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8ad048bd35b271f3f5398bc2d4f6f989b4b62dd5))
* **uniques:** add favourites to the Unique Items page ([a7b1778](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a7b1778b720ba572c00b231a1bc9cd14568a1727))


### Bug Fixes

* harden Supabase write access and address build-sharing review findings ([60e2bf1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/60e2bf183ac4eabd09b462884c4d3d73df80e35c))
* **spa:** harden GitHub Pages deep-link fallback ([88d0826](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/88d082658e0638eb4b8660ff6b543dd39150459e))


### Documentation

* **privacy:** add privacy policy ([cdefe1b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/cdefe1bb68c3fc62665fef280ce26a9391c9bc0f))
* rewrite README for released app ([9a8654a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9a8654afa7c422c0de1b1d26410f573eca141063))


### CI

* deploy only via manual workflow_dispatch ([29f720f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/29f720fe88618e13e5ad0cd80646b7f265b65411))

## [1.10.1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.10.0...v1.10.1) (2026-06-06)


### Bug Fixes

* **data-sync:** make store step transactional and reuse fetched ESR version ([0a59e58](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0a59e58eec5190be5b5683409635d7c8d9f089d4))
* **store:** start sagas registered after middleware startup ([84f81f3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/84f81f373c23ce124af4fba711beaabcabfd4231))


### Documentation

* disclose Cloudflare Web Analytics in privacy policy plan ([6a06a17](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6a06a17bc56d5260509f152109a1e8fc21ae8905))


### Chores

* add .env.example template and justify slider useMemo ([7d5d7d8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7d5d7d813474e09e07453e8ff439db105011f828))
* bump in-range dependencies ([3a111ad](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3a111ad2deda6b86b3c7ff096765ca773fd8dda0))


### Refactoring

* **core:** extract useDebouncedFilterValue hook ([790bc81](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/790bc810359a4c1e53ed7c48c3202473f4c5fd8f))
* **core:** use NavLinks in mobile nav instead of delayed navigation ([4e2e78f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4e2e78feb0bc5b0dbc49a860151a44f6a71a5510))
* **data-sync:** unify cache completeness checks ([96625a3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/96625a388efa3fe1f10957a1d461e20b0058fa5e))
* replace '__none__' magic string with named sentinel constant ([549b581](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/549b581a523a4ba0435f66b3bbdc50707b237407))


### Tests

* **data-sync:** cover transactional store step at saga level ([3680d7b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3680d7b56d1687607dc1035b92e982c02fd6566e))

## [1.10.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.9.2...v1.10.0) (2026-06-06)


### Features

* add gemwords, favourites, and lazy routes to the project with some perf improvements in css ([9ba9d7b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9ba9d7b86cc202146694c2774e4a8153eed81b59))

## [1.9.2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.9.1...v1.9.2) (2026-05-27)


### Chores

* pin Node version to 22 via .nvmrc and ([2bc0775](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2bc0775f7ce3929d5fb595571d6b4966a8d55341))


### CI

* bump GitHub Actions to Node 24 versions ([5fb6b24](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5fb6b24f7ea018ad92bd77690e0c817a7215403e))

## [1.9.1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.9.0...v1.9.1) (2026-05-27)


### Documentation

* update the feature doc for builds based on POCs and plannign with LLMs ([c80f281](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c80f281d843a2df1936da4549bec4ccdcea74576))


### Chores

* update dependencies ith audit --fix ([b05542a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b05542a7f3a33a99f4ec1c89349f9568a8075893))
* update dependencies within semver ranges and fix lint issues ([8aa905b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8aa905bc827248831b83db26fb587c3f35a42f80))

## [1.9.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.8.0...v1.9.0) (2026-03-29)


### Features

* add support for ascendancies ([e39fb76](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e39fb7687d6415ca29e0197f713a283d300d4df9))


### Documentation

* add the initial feature doc for builds and privacy policy ([bd5ef10](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/bd5ef1059d91ebfa0a36275caab90d9cf6259049))

## [1.8.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.7.1...v1.8.0) (2026-03-20)


### Features

* add support for Mythical uniques ([16aaf68](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/16aaf68f68b0ef9aed47831af77ff63e56487272))


### Documentation

* update the docs to represent the current implementation ([3cbe711](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3cbe7115c2e7ea62b77a7e843ad62db2921315c3))

## [1.7.1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.7.0...v1.7.1) (2026-03-08)


### Chores

* add Cloudflare analytics for network debug ([0c54c12](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0c54c12f2447268e1cfba923838f7a14844be597))

## [1.7.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.6.0...v1.7.0) (2026-03-07)


### Features

* remove the temporary proxy ([56fc4d5](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/56fc4d59dd0b49cf5b6b39909bbbb079068967e9))

## [1.6.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.5.0...v1.6.0) (2026-03-07)


### Features

* add temporary proxy because the site moved to HTTP webpage ([9c97534](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9c97534ba9bc68d6f8b8fbd3d82c85a238720dee))

## [1.5.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.4.0...v1.5.0) (2026-03-05)


### Features

* add the optional jewel info to the runewords ([fba3841](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fba384190873f64f6b4e2d795e6127470764a33e))

## [1.4.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.3.0...v1.4.0) (2026-03-04)


### Features

* add the ability for runewords to have gems ([6cd81c2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6cd81c25e0be9be551dac15756b0f05b8670663c))

## [1.3.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.2.1...v1.3.0) (2026-03-02)


### Features

* add HTM based unique items ([727e54b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/727e54b050da19cd1c9ca6d1adc8aa16e4fe0058))


### Refactoring

* delete the old d2r-esr-txt-data indexeddb ([a3b8cdf](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a3b8cdfe7b80c83bda36209ec283c1c150bd0360))
* performance related refactors after code review ([b9ca00c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/b9ca00c3eee1eb4eab773c81395e1e4fcf53a406))
* purge the old TXT file based uniques page ([fe143f1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fe143f1c0b0ebcfeb8d93470e8f841822d6a5d8d))

## [1.2.1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.2.0...v1.2.1) (2026-03-02)


### Chores

* update some min-widths for the checkbox groups ([dc2145e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/dc2145ee965c281d2c8501e20a35f071b96fc4e9))

## [1.2.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.1.0...v1.2.0) (2026-03-02)


### Features

* add a clear all button to clear all the runepoints tier filters with one click ([1655377](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/16553776048ef295dda8c0766279f7263338df08))
* add item count label also in the title ([66b1012](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/66b10123df64d1fc92c2a6cf726ce4fd570ec0a0))
* add Only highest gem / crystal to socketables page ([ae3bcaf](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ae3bcaf689c3d23deccc2d4d03f0499c3d7bb497))
* add scroll to top FAB on screens / bottom right corner ([3ed2503](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3ed25036ca79e020641b9f833f56f3cc23ef1716))
* show the number of shown items on runewords and uniques ([550e12b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/550e12b0b89671281723f50894655f6ebf35b611))


### Chores

* update the search help descriptions for the pages ([d7d436e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d7d436eb497bba8584c0ff329f6935e75679bf81))

## [1.1.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v1.0.0...v1.1.0) (2026-03-01)


### Features

* add checkbox toggles for categories for Item Types ([8220cd1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8220cd1003d619038f1c95e0f4838ed08ed62844))

## [1.0.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.14...v1.0.0) (2026-03-01)


### Features

* add per-column runeword bonuses, split cards, and comprehensive integration test ([076edc3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/076edc35747679468e4f876e323b5558a3e3dd07))

## [0.1.14](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.13...v0.1.14) (2026-02-27)


### Features

* add categories for item types ([1f3be96](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/1f3be96450e4b063d24147ee4eb00150e17a0337))

## [0.1.13](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.12...v0.1.13) (2026-02-27)


### Features

* update colors for rune texts and badges ([817dc53](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/817dc53991ca6ee39d7ab2a561afedbec57c64ba))

## [0.1.12](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.11...v0.1.12) (2026-02-27)


### Features

* add data re-parse on app version change even if there are no changelog changes ([e2423c9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e2423c9b22dd2275264318f241451ee6a0526b2c))

## [0.1.11](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.10...v0.1.11) (2026-02-27)


### Features

* add tier points filter, fix rune classification bugs, and UI improvements ([4412ca4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4412ca4a9fbfe2effb06467a04c3aa0d21e3fbe2)), closes [#908858](https://github.com/istvan-panczel/d2r-esr-runeword-browser/issues/908858)

## [0.1.10](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.9...v0.1.10) (2026-01-07)


### Bug Fixes

* fix the Drawers in mobile view (scrollbar, lagging) ([f116ce2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f116ce201c8d534b6d298945e1cc03091ce5416e))

## [0.1.9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.8...v0.1.9) (2026-01-06)


### Features

* add req. level ([82328ae](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/82328aede6a2a5b3b3eb0c42f0bbee65533d540d))

## [0.1.8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.7...v0.1.8) (2026-01-05)


### Features

* better navigation for mobile view ([80c8117](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/80c81172ed176a560c9c822eec44b66a177c4930))

## [0.1.7](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.6...v0.1.7) (2026-01-04)


### Features

* add support for the newly introduced points in the docs ([4c7e0e8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4c7e0e8fee35d5a87cfc57aa68140bc358c1d67d))

## [0.1.6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.5...v0.1.6) (2026-01-02)


### Features

* add checkbox to include coupon items for uniques page ([34950f5](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/34950f564abbba8bcf01161e340fa4a65e8e7745))

## [0.1.5](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.4...v0.1.5) (2026-01-02)


### Bug Fixes

* fixup the sharable link generation for all pages ([7e39e23](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7e39e2325550c28568c8f20ce7a1370c80fdd34b))

## [0.1.4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.3...v0.1.4) (2026-01-02)


### Bug Fixes

* fix 404 redirect issues for SPAs on Github Pages ([3e33663](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3e336638486966675f03d312ba12f2ad12a93814))

## [0.1.3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.2...v0.1.3) (2025-12-31)


### Features

* add item tiers, search help, header links, and improved logging ([12f59d4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/12f59d4c8a3355f93bf5a3d47b472bb8476f00ea))

## [0.1.2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.1...v0.1.2) (2025-12-30)


### Bug Fixes

* fix some parsing issues and property mapping ([67010d6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/67010d6abaf88e8ec354286d215d23b865f79aee))

## [0.1.1](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.1.0...v0.1.1) (2025-12-30)


### Bug Fixes

* fix quickly the basepath for the txt resources ([796fca0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/796fca0533249b16c49957c0450d658f419ae0e1))

## [0.1.0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.0.9...v0.1.0) (2025-12-30)


### ⚠ BREAKING CHANGES

* add txt based parsing and the Uniques page

### Features

* add txt based parsing and the Uniques page ([4209258](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/420925819d9b2f70f318ca16dcc2e87cea295617))


### Chores

* update plugins ([c4054db](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c4054db2b4eb674435c4effd1771535dc9da23c4))

## [0.0.9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.0.8...v0.0.9) (2025-12-25)


### Features

* add the option to change the font ([6c98847](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6c98847c140c214f1fcc8af437e6cd035a1461b1))

## [0.0.8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.0.7...v0.0.8) (2025-12-25)


### Features

* add exact phrases search for socketables ([e129517](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e12951790e2f28001843f78427e928bd3dd8ef76))
* add shareable urls and copy for filters ([8e4fae8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8e4fae8228533ef230e45ebef053ab46ed3937d4))


### Refactoring

* extract filter helpers and increase test coverage of the app ([99c01c0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/99c01c0bfbc2e8d1ae1f548f9328b2e7ebbc6030))

## [0.0.7](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.0.6...v0.0.7) (2025-12-25)


### Bug Fixes

* fix the left out version form the release script ([8aaafce](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8aaafce954262f8fe691a80c15fef737ea826d2b))

## [0.0.6](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.0.5...v0.0.6) (2025-12-25)


### Features

* add better ways to filter, and some descriptions for the user ([93dc78a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/93dc78ac4f85bc252c21b3a3b58ad138c4e45fdd))


### Chores

* add version tag, script to check socketables, some SEO ([acec140](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/acec14038bc0e57fcd119c93a35e6624864b4414))


### Tests

* extra integration test to verify socketables completedness ([beff389](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/beff389f21f3c99afd4dd62f9389a22d10d87f85))

## [0.0.5](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.0.4...v0.0.5) (2025-12-24)


### Features

* renaem and trigger github actions ([f88bacf](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f88bacf7c8bcd9682e8f2f741d88aeda54a28922))

## [0.0.4](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.0.3...v0.0.4) (2025-12-24)


### Chores

* add github actions for the github page ([bd65880](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/bd65880405edfae877670db042c34c6bde5f11b2))

## [0.0.3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.0.2...v0.0.3) (2025-12-24)


### Tests

* remove te local htm files and introduce a script to download them ([856ad01](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/856ad0115ef2868807227275b2eae1cc7f07a1c1))

## [0.0.2](https://github.com/istvan-panczel/d2r-esr-runeword-browser/compare/v0.0.1...v0.0.2) (2025-12-24)


### Features

* add errorhandling if the user deletes the DB ([80b4025](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/80b4025a7080fe134949e9cb361278fa907c2938))
* add gems parser POC from local htm ([5945baa](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/5945baac9926079cd26212c3288a203a44dac706))
* add runeword parsing ([d3bb64a](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d3bb64ace7a83498fa179789ac18432511387045))
* add runewords page ([354ec29](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/354ec2971b24b740211635bab275351483e5e565))
* add shadcn ui with the default theme to the project ([0a50f9e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/0a50f9ec6a8aa3c5dc7b884125b7e65c558ceb84))
* add the actual data fetching with version based cache ([6afd1c9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/6afd1c95535d1961e6f4a24f0b3a07742a8c5f1a))
* add the app base and the socketables screen ([f9946ff](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f9946ffb38c81123e8141c0bbc4a8c88fe343745))
* add the functionality to extract the affixes into a separate table ([a3fcf7c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a3fcf7cdbfebfce7ab9f6fce7ec6b2f856c91d86))
* add the rest of gems.htm parser - it jsut works for now ([312e259](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/312e259ccee7470c18b7f75539317ffc5f0b54df))
* small UI facelift ([98bd5ac](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/98bd5acfb23b4e881112ec70d194f8fc48c511ec))


### Bug Fixes

* fix bugs and bugs and even more bugs ([e1782dd](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e1782dd231cdac8ac9cb3fe6fdc6083b426bf461))
* fix more bugs, show and search in rune bonuses ([a7c7e0b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/a7c7e0ba672c905ce02772f77662b23d64b30b50))
* fix more issues with oarsing lod runewords ([4c6552e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4c6552eb1e596f855980e130407a7dcd38875f90))


### Documentation

* add core data and runewords feature documentations for the project ([d86de26](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/d86de264a4bdb44ec43855e17d0854dd53953bd1))
* add docs for sagas and testing ([fdf1c22](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fdf1c2254e4ec9489e9409184d7e30f642fd58f6))
* add first technical documentations for the project ([3e73c2e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/3e73c2ec862a0042d7b7230f9615852da6412ff2))
* Add MIT License to the project ([36f3ee8](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/36f3ee8b392a8cdac30be222e7d7c032b816725e))
* init brainstorming with Claude ([9796613](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/9796613563ddb48e29d7d7dd2fcd0dc21b43a168))
* update the feature documentations after re-thinking the functionalities ([edfba25](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/edfba2573fb65b02e4c031196af482675e87dfa3))
* wrap up the documentation before creating POCs for parsing and Dexie ([ea69699](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/ea69699c7d6eba45785f1d24ca5246a2219248bc))


### Chores

* add path aliases for import paths ([8a4342e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/8a4342e5a94079ad4f96c20380004032e1cfcbda))
* add to eslint to prefer readonly and to explicitly check for hook dependencies ([abfa92f](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/abfa92f879ab05046c85bf3d31bbd88641ff706d))
* enable React Compiler in the project ([4665fdf](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/4665fdf10e720f41340c37b4769557dbec954e8f))
* init CLAUDE ([02920fd](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/02920fd0ee1a9dbf28ff7f87869aebce82971ffa))


### Refactoring

* remove unnecessary IDs from the modals and better error handling ([f7baaae](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/f7baaaec6d373e83df40d9f2e0f75e74f6409f7b))
* separate smaller saga functions for data sync ([e1ebec9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e1ebec972a38ca381d80aab04245c9f609c9122e))
* use parallel bulk writes for the gems.htm parsing results ([2c7d31c](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2c7d31c4c5e10783c0b7cd6be5413f3c560b85bf))


### Tests

* introduce integration testing to the project ([7f6dc1e](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/7f6dc1e486c7a53eff095878a93c3878c273b62b))
* introduce unit testing to the project ([e632f3b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e632f3b19544b470d59e761046ebeb069105bbd3))

## 0.0.1 (2025-12-21)


### Chores

* add commit-and-tag-version for release version management ([2670369](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/267036976330c1461f7bc3cacbfe26abc35928e9))
* add config to remove console logs in production build ([e8d101b](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e8d101bc0b4666881612a4ef81202b1e799c49ee))
* add eslint plugin for prettier ([fcd10b9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/fcd10b92644e8271c4821543f18aa34b2e2559e0))
* add husky and lint-staged for prettier and eslint checks ([43263b9](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/43263b9e7d1bb7d004891513e93a6ff72fd750cc))
* add prettier to the project ([2d220f0](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/2d220f0d5bc4237372fb6a5569287403b806f078))
* add the recommended strict eslint rules, add lint:fix npm script, and fix the main.tsx issue ([e650317](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/e650317949931567cd35209727e21c8092ef4de8))
* init ([c208cd3](https://github.com/istvan-panczel/d2r-esr-runeword-browser/commit/c208cd33dba961903f81a929cd010b4906578792))
