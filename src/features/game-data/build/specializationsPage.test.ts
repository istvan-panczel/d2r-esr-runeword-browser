import { describe, expect, it } from 'vitest';
import { parseSpecializationsPage } from './specializationsPage.ts';

const PAGE = `
<td><font face="arial,helvetica" size="-1">
  Mystical Shards drop from strong monsters in endgame level zones.<br>
  Transmute 10 Mystical Shards to create a Mystical Tesseract.<br>
  More points are unlocked automatically at levels 45, 60, 75 and 90.<br>
  (e.g. you get 3 points if you use it at level 63).<br>
  <font color="orange">Alchemist</font> - Specialized in potions.<br>
  <font color="orange">Jeweler</font> - Specialized in jewelry, gems and jewels.<br>
  Each specialization has 15 perks, 3 perks per row. You can choose 1 perk out of 3 for each row.<br>
  You can have a maximum of 5 points.<br>
  This requires 5 respec points (equivalent to 20 dragon stones).<br>
</font></td>
<div class="spw-wrap">
  <label for="spw-tab1" class="spw-tab spw-tab1" style="left:32px;">Alchemist</label>
  <label for="spw-tab2" class="spw-tab spw-tab2" style="left:177px;">Jeweler</label>
  <div class="spw-page spw-page1">
    <div class="spw-perk" style="left:1px;">
      <div class="spw-socket"></div>
      <div class="spw-tip">
        <div class="spw-tip-title">Efficient Remedies</div>
        <div class="spw-tip-text">Increase the effect of healing and mana potions by 20%.</div>
        <div class="spw-tip-hint">Shift + Click to Unlearn.<br>Costs 5 Respec Points.</div>
      </div>
    </div>
    <div class="spw-perk"><div class="spw-tip-title">Hidden Elixirs</div><div class="spw-tip-text">You can find utility potions that don&#39;t normally drop.</div></div>
  </div>
  <div class="spw-page spw-page2">
    <div class="spw-perk"><div class="spw-tip-title">My Precious</div><div class="spw-tip-text">You can only wear one ring</div></div>
  </div>
</div>`;

describe('parseSpecializationsPage', () => {
  const page = parseSpecializationsPage(PAGE);

  it('reads the intro numbers and the tree summaries', () => {
    expect(page.intro).toEqual({
      shards: 10,
      pointLevels: [45, 60, 75, 90],
      example: { points: 3, level: 63 },
      perksPerTree: 15,
      perksPerRow: 3,
      maxPoints: 5,
      respecPoints: 5,
      respecDragonStones: 20,
      summaries: new Map([
        ['Alchemist', 'Specialized in potions.'],
        ['Jeweler', 'Specialized in jewelry, gems and jewels.'],
      ]),
    });
  });

  it('reads each tab with its perk tooltips', () => {
    expect(page.trees).toEqual([
      {
        name: 'Alchemist',
        perks: [
          {
            title: 'Efficient Remedies',
            text: 'Increase the effect of healing and mana potions by 20%.',
            hint: 'Shift + Click to Unlearn. Costs 5 Respec Points.',
          },
          { title: 'Hidden Elixirs', text: "You can find utility potions that don't normally drop.", hint: '' },
        ],
      },
      { name: 'Jeweler', perks: [{ title: 'My Precious', text: 'You can only wear one ring', hint: '' }] },
    ]);
    expect(page.warnings).toEqual([]);
  });

  it('warns about a page without tabs or a tab without its page', () => {
    expect(parseSpecializationsPage('<p>nothing</p>').warnings).toEqual(['docs/specializations.htm: no tree tabs (spw-tab) found']);
    expect(parseSpecializationsPage('<label for="spw-tab3" class="spw-tab">Blacksmith</label>').warnings).toEqual([
      'docs/specializations.htm: tab Blacksmith has no page (spw-page3)',
    ]);
  });
});
