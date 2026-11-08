import { describe, expect, it } from 'vitest';
import { parseKillLedgerPage } from './killLedgerPage.ts';

const row = (left: string, right: string) => `<tr><td>${left}</td><td>${right}</td></tr>`;
const PAGE = `<table>
  <tr><td colspan="2"><b>Kill Bonuses</b></td></tr>
  ${row('<font>Kill Ledger</font><br>(At least 5000 kills)<br>Any Blemished Gem<br>', 'Kill Ledger<br>+10% to All Speeds<br>')}
  ${row('Kill Ledger<br>(At least 50000 kills)<br>Any Perfect Gem x2<br>', 'Kill Ledger<br>Increase Maximum Life +10%<br>Increase Maximum Mana +10%<br>')}
  <tr><td colspan="2"><b>Boss Bonuses</b><br>You have 60 seconds to transmute your Kill Ledger after you kill the boss.</td></tr>
  ${row('Kill Ledger<br>2x Flawed Burning Sulphur<br>Perfect Topaz<br>Mephisto the Invincible just killed<br>', 'Kill Ledger<br>Lightning Absorb +2%<br>')}
</table>`;

describe('parseKillLedgerPage', () => {
  const page = parseKillLedgerPage(PAGE);

  it('reads the kill bonus rows', () => {
    expect(page.tiers).toEqual([
      { kills: 5000, ingredients: ['Any Blemished Gem'], bonus: ['+10% to All Speeds'] },
      { kills: 50000, ingredients: ['Any Perfect Gem x2'], bonus: ['Increase Maximum Life +10%', 'Increase Maximum Mana +10%'] },
    ]);
  });

  it('reads the boss bonus rows and the window', () => {
    expect(page.bosses).toEqual([
      { name: 'Mephisto the Invincible', ingredients: ['2x Flawed Burning Sulphur', 'Perfect Topaz'], bonus: ['Lightning Absorb +2%'] },
    ]);
    expect(page.windowSeconds).toBe(60);
    expect(page.warnings).toEqual([]);
  });

  it('warns about rows of neither kind and about an empty page', () => {
    expect(parseKillLedgerPage(`<table>${row('Something else', 'x')}</table>`).warnings).toEqual([
      'docs/kill_ledger.htm: row "Something else" is neither a kill nor a boss bonus',
      'docs/kill_ledger.htm: no kill bonuses found',
      'docs/kill_ledger.htm: no boss bonuses found',
    ]);
  });
});
