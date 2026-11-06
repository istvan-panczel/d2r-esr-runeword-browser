import { describe, expect, it } from 'vitest';
import type { SkillDetail } from '../engine/schema.ts';
import { serializeBundle } from './writeBundle.ts';
import { applySkillInfoPage, cellParagraphs, createNameResolver, expandSkillHeading, parseSkillInfoPage } from './skillInfoPage.ts';

/** A cell as the page writes it (inline styles, a <font> wrapper, hand-wrapped text) */
const cell = (html: string) => `<td style="background-color:#262322; border:2px solid #000;">
                    <font face="arial,helvetica" size="-1">${html}
                    </font>
                </td>`;
const row = (...cells: string[]) => `<tr>${cells.map(cell).join('\n')}</tr>`;

const PAGE = `<html><body>
  <table width="100%"><tr><td><font>Here you can find information about mercenaries and various oskills.<br></font></td></tr></table>
  <table cellpadding="5">
    <tr style="background-color:#402040;"><td colspan="4" style="text-align: center;"><b>Mercenaries</b></td></tr>
    <tr style="background-color:#402040;"><th>Hireling</th><th>Subtype</th><th>Skills</th></tr>
    <!-- Desert Mercenary -->
    ${row('Desert Mercenary', 'Comb - Nightmare', 'Fanaticism, Fend, Spearstorm, Dance of\n                        Death')}
    ${row('Eastern Sorcerer', 'Lightning', 'Lightning Damage Aura, Conduit, Ancients&#39; Presence')}
  </table>
  <a name="oskills"></a>
  <table cellpadding="5">
    <tr style="background-color:#402040;"><td colspan="3" style="text-align: center;"><b>Oskills</b></td></tr>
    <tr style="background-color:#402040;"><th>Skill</th><th>Description</th></tr>
    ${row('Fire/Cold/Lightning/Poison/Magic/Wind Surge', 'A small area of effect instant spell damage\n   skill. Each skill gets synergy bonuses.')}
    ${row('Warm Up', 'A buff that grants 2% attack speed per level.<br>Also regenerates life.')}
    ${row('Delirium', 'Curse Immunity (does <strong>NOT</strong> clear present curses) for 4 seconds.')}
    ${row('Axe Throw', 'A simple axe.')}
    ${row('Empowered Enchant', 'Every variant.')}
    ${row('Made Up Skill', 'Nobody has it.')}
  </table>
</body></html>`;

function detail(id: string, name: string, cls: SkillDetail['cls'] = null, description: string[] = []): SkillDetail {
  return { id, name, cls, page: cls === null ? null : 1, reqLevel: 1, maxLevel: 20, description };
}

const SKILLS = (): SkillDetail[] => [
  detail('Fanaticism', 'Fanaticism', 'pal', ['Increases attack speed']),
  detail('Fend', 'Fend', 'ama'),
  detail('Spearstorm', 'Spearstorm', 'ama'),
  detail('Dance of Death', 'Dance of Death', 'ama'),
  detail('Conduit', 'Conduit', 'sor'),
  detail('Conduit Proc', 'Conduit'),
  detail('Lightning Damage Aura', 'Lightning Damage Aura', null, ['An aura']),
  detail('Shout of the Ancients', 'Shout of the Ancients', 'bar'),
  ...['Fire', 'Cold', 'Lightning', 'Poison', 'Magic', 'Wind'].map((element) => detail(`${element} Surge`, `${element} Surge`)),
  detail('Warm Up', 'Warm Up'),
  detail('Delerium Change', 'Delirium'),
  detail('Axe Proc', 'Thrown Axe'),
  detail('Empowered Enchant Cold', 'Empowered Enchant'),
  detail('Empowered Enchant Fire', 'Empowered Enchant'),
];

describe('expandSkillHeading', () => {
  it('expands slash groups with the last member’s suffix', () => {
    expect(expandSkillHeading('Fire/Cold/Lightning/Poison/Magic/Wind Surge')).toEqual([
      'Fire Surge',
      'Cold Surge',
      'Lightning Surge',
      'Poison Surge',
      'Magic Surge',
      'Wind Surge',
    ]);
    expect(expandSkillHeading('Fire/Cold/Lightning Damage Aura')).toEqual([
      'Fire Damage Aura',
      'Cold Damage Aura',
      'Lightning Damage Aura',
    ]);
    expect(expandSkillHeading('Fire/Cold/Lightning/Magic/Non-Elemental Spike Nova')).toEqual([
      'Fire Spike Nova',
      'Cold Spike Nova',
      'Lightning Spike Nova',
      'Magic Spike Nova',
      'Non-Elemental Spike Nova',
    ]);
  });

  it('splits comma parts and keeps multi-word members', () => {
    expect(expandSkillHeading('Axe Throw, Fire/Cold/Lightning/Magic Enhanced Axe')).toEqual([
      'Axe Throw',
      'Fire Enhanced Axe',
      'Cold Enhanced Axe',
      'Lightning Enhanced Axe',
      'Magic Enhanced Axe',
    ]);
    expect(expandSkillHeading('Blades of Ice/Claws of Thunder/Fists of Fire Discharge')).toEqual([
      'Blades of Ice Discharge',
      'Claws of Thunder Discharge',
      'Fists of Fire Discharge',
    ]);
    // The first member is as long as the last: one word of the last one is its own prefix
    expect(expandSkillHeading('Dragon Fury/Execute Discharge')).toEqual(['Dragon Fury Discharge', 'Execute Discharge']);
    expect(expandSkillHeading("Death's Web")).toEqual(["Death's Web"]);
  });
});

describe('parseSkillInfoPage', () => {
  it('reads the Oskills and Mercenaries tables, skipping the title and header rows', () => {
    const page = parseSkillInfoPage(PAGE);
    expect(page.warnings).toEqual([]);
    expect(page.mercenaries).toEqual([
      { hireling: 'Desert Mercenary', subtype: 'Comb - Nightmare', skills: ['Fanaticism', 'Fend', 'Spearstorm', 'Dance of Death'] },
      { hireling: 'Eastern Sorcerer', subtype: 'Lightning', skills: ['Lightning Damage Aura', 'Conduit', "Ancients' Presence"] },
    ]);
    expect(page.oskills.map((entry) => entry.heading)).toEqual([
      'Fire/Cold/Lightning/Poison/Magic/Wind Surge',
      'Warm Up',
      'Delirium',
      'Axe Throw',
      'Empowered Enchant',
      'Made Up Skill',
    ]);
    expect(page.oskills[0]?.text).toEqual(['A small area of effect instant spell damage skill. Each skill gets synergy bonuses.']);
    expect(page.oskills[0]?.names).toHaveLength(6);
    // <br> breaks paragraphs, tags are stripped
    expect(page.oskills[1]?.text).toEqual(['A buff that grants 2% attack speed per level.', 'Also regenerates life.']);
    expect(page.oskills[2]?.text).toEqual(['Curse Immunity (does NOT clear present curses) for 4 seconds.']);
  });

  it('warns when a table is missing', () => {
    expect(parseSkillInfoPage('<html></html>').warnings).toEqual([
      'skilldetails: skill_information.htm has no "Oskills" table',
      'skilldetails: skill_information.htm has no "Mercenaries" table',
    ]);
  });

  it('normalises cell text', () => {
    expect(cellParagraphs('<font> a&nbsp;b &amp; c<br/>\n  d </font>')).toEqual(['a b & c', 'd']);
  });
});

describe('createNameResolver', () => {
  it('matches names, then skills.txt ids, then aliases; same-name variants all match', () => {
    const resolve = createNameResolver(SKILLS());
    expect(resolve('warm up').map((skill) => skill.id)).toEqual(['Warm Up']);
    expect(resolve('Delerium Change').map((skill) => skill.id)).toEqual(['Delerium Change']);
    expect(resolve('Axe Throw').map((skill) => skill.id)).toEqual(['Axe Proc']);
    expect(resolve('Empowered Enchant').map((skill) => skill.id)).toEqual(['Empowered Enchant Cold', 'Empowered Enchant Fire']);
    expect(resolve('Conduit').map((skill) => skill.id)).toEqual(['Conduit', 'Conduit Proc']);
    expect(resolve('Conduit', true).map((skill) => skill.id)).toEqual(['Conduit']);
    // classFirst keeps item skills when no class skill has the name
    expect(resolve('Lightning Damage Aura', true).map((skill) => skill.id)).toEqual(['Lightning Damage Aura']);
    expect(resolve('Nope')).toEqual([]);
  });
});

describe('applySkillInfoPage', () => {
  const run = () => {
    const skills = SKILLS();
    const result = applySkillInfoPage(skills, parseSkillInfoPage(PAGE), new Set(['Made Up Skill']));
    return { skills, result };
  };

  it('attaches the text and the mercenaries, counts and warns on unmatched names', () => {
    const { skills, result } = run();
    const byId = (id: string) => skills.find((skill) => skill.id === id);
    expect(byId('Fire Surge')?.infoPage).toEqual({
      heading: 'Fire/Cold/Lightning/Poison/Magic/Wind Surge',
      text: ['A small area of effect instant spell damage skill. Each skill gets synergy bonuses.'],
    });
    expect(byId('Wind Surge')?.infoPage?.heading).toBe('Fire/Cold/Lightning/Poison/Magic/Wind Surge');
    expect(byId('Empowered Enchant Fire')?.infoPage?.text).toEqual(['Every variant.']);
    expect(byId('Fanaticism')?.mercenaries).toEqual([{ hireling: 'Desert Mercenary', subtype: 'Comb - Nightmare' }]);
    expect(byId('Shout of the Ancients')?.mercenaries).toEqual([{ hireling: 'Eastern Sorcerer', subtype: 'Lightning' }]);
    expect(byId('Conduit')?.mercenaries).toHaveLength(1);
    expect(byId('Conduit Proc')?.mercenaries).toBeUndefined();
    expect(result.unmatched).toEqual(['Made Up Skill']);
    expect(result.warnings).toEqual([
      'skilldetails: skill_information.htm Oskills "Made Up Skill" names "Made Up Skill": a skills.txt skill not in skilldetails.json',
    ]);
    expect(result.counts).toEqual({
      skillInfoEntries: 6,
      skillInfoNames: 11,
      skillInfoSkills: 11,
      skillInfoOnlyDescription: 11,
      skillInfoMercenaryRows: 2,
      skillInfoMercenarySkills: 7,
      skillInfoMercenaryLinks: 7,
      skillInfoUnmatched: 1,
    });
  });

  it('is deterministic', () => {
    const first = run();
    const second = run();
    expect(serializeBundle(second.skills)).toBe(serializeBundle(first.skills));
    expect(second.result).toEqual(first.result);
  });
});
