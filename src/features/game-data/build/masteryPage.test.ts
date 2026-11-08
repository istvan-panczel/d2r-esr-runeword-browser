import { describe, expect, it } from 'vitest';
import { parseMasteryPage } from './masteryPage.ts';

const PAGE = `
<td><font>
  endgame map bosses (25% chance, not scaled by /players).<br>
  have a chance to drop a weapon mastery token (up to 75%, not scaled by /players) and more.
</font></td>
<a name="specializations"></a>
<table>
  <tr><td colspan="2"><b>Specializations</b></td></tr>
  <tr>
    <td bgcolor="#101010"><font size="-1">Reflex Bow Variant<br>
      <FONT color="#706850">Awakened Weapon Mastery Token</FONT><br>
      <FONT color="gray">Spider's Silk</FONT><br>
      <FONT color="purple">Anvil Stone</FONT></font></td>
    <td bgcolor="#101010"><font size="-1">
      <font color="orange">Strafe</font><br>
      Triples the number of targets, but applies a<br>penalty<br>
      <br>
      <font color="orange">Multiple Shot</font><br>
      Fires a nova
    </font></td>
  </tr>
  <tr>
    <td bgcolor="#101010"><font>Assassin Claw<br><FONT>Awakened Weapon Mastery Token</FONT><br><FONT>Chipped Skull</FONT></font></td>
    <td bgcolor="#101010"><font size="-1">
      <font color="orange">Elemental Charge-up Skills</font><br>
      Lowers the base damage<br>
      This effect stacks*
      </font><br><br><font size="-1" color="gray">*this damage bonus does not apply for discharge procs</font></td>
  </tr>
</table>`;

describe('parseMasteryPage', () => {
  const page = parseMasteryPage(PAGE);

  it('reads the two drop chances of the intro', () => {
    expect(page.mapBossChance).toBe(25);
    expect(page.zakarumChance).toBe(75);
    expect(page.warnings).toEqual([]);
  });

  it('reads each row: weapon, ingredients, skills lines with their effect lines and footnotes', () => {
    expect(page.rows).toEqual([
      {
        weapon: 'Reflex Bow Variant',
        ingredients: ["Spider's Silk", 'Anvil Stone'],
        effects: [
          { heading: 'Strafe', lines: ['Triples the number of targets, but applies a', 'penalty'] },
          { heading: 'Multiple Shot', lines: ['Fires a nova'] },
        ],
        notes: [],
      },
      {
        weapon: 'Assassin Claw',
        ingredients: ['Chipped Skull'],
        effects: [{ heading: 'Elemental Charge-up Skills', lines: ['Lowers the base damage', 'This effect stacks'] }],
        notes: ['this damage bonus does not apply for discharge procs'],
      },
    ]);
  });

  it('warns about a page without its table or a sentence it cannot read', () => {
    expect(parseMasteryPage('<p>nothing</p>').warnings).toEqual([
      'docs/weapon_mastery.html: no specializations table found',
      'docs/weapon_mastery.html: no map boss drop chance sentence found',
      'docs/weapon_mastery.html: no Corrupted Zakarum drop chance sentence found',
    ]);
  });
});
