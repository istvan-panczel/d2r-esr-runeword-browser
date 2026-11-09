import { describe, expect, it } from 'vitest';
import { areaSearchNames, homeResultHref, rankNames, runewordsSearchHref, searchHome, skillSearchNames } from './homeSearch';

describe('rankNames', () => {
  const names = ['Black Enigma', 'Enigma', 'Enigmatic Ring', 'Stenigma', 'Oath', 'Mosaic'];

  it('matches case-insensitive substrings, exact then prefix then word prefix then substring', () => {
    expect(rankNames(names, 'enigma')).toEqual(['Enigma', 'Enigmatic Ring', 'Black Enigma', 'Stenigma']);
  });

  it('orders ties alphabetically and caps the list', () => {
    const many = ['Shadow D', 'Shadow B', 'Shadow A', 'Shadow C'];
    expect(rankNames(many, 'shadow', 3)).toEqual(['Shadow A', 'Shadow B', 'Shadow C']);
  });

  it('collapses duplicates (runeword variants) and ignores an empty query', () => {
    expect(rankNames(['Insight', 'Insight', 'insight'], 'ins')).toEqual(['Insight']);
    expect(rankNames(names, '   ')).toEqual([]);
  });

  it('unifies apostrophes and whitespace like the exact-name focus', () => {
    expect(rankNames(["Artemis' Wrath"], 'artemis’ w')).toEqual(["Artemis' Wrath"]);
    expect(rankNames(['Call to Arms'], '  call   to ')).toEqual(['Call to Arms']);
  });

  it('treats regex characters in the query literally', () => {
    expect(rankNames(['A (b)', 'Ab'], '(b')).toEqual(['A (b)']);
  });
});

describe('searchHome', () => {
  it('returns non-empty groups in category order and skips missing sources', () => {
    const groups = searchHome('ring', {
      bases: ['Ring', 'Ring Mail'],
      setItems: ['Angelic Halo (Ring)'],
      runewords: ['Ring of Fire'],
      uniques: ['Sword'],
    });
    expect(groups.map((g) => g.category)).toEqual(['runewords', 'setItems', 'bases']);
    expect(groups[2]?.results.map((r) => r.name)).toEqual(['Ring', 'Ring Mail']);
  });

  it('caps every group at six by default', () => {
    const names = Array.from({ length: 10 }, (_, i) => `Rune ${String(i)}`);
    expect(searchHome('rune', { runewords: names })[0]?.results).toHaveLength(6);
  });

  it('appends skills, modifiers, materials, areas and cube recipes after bases', () => {
    const groups = searchHome('fire', {
      cube: [{ name: 'Fire facets', id: 'facets-fire' }],
      areas: ['Fire Pit'],
      materials: ['Fire Rune'],
      modifiers: [{ name: 'Fire Resist', id: 'resist-fire' }],
      skills: [{ name: 'Fire Bolt', id: 'Fire Bolt' }],
      bases: ['Fire Staff'],
    });
    expect(groups.map((g) => g.category)).toEqual(['bases', 'skills', 'modifiers', 'materials', 'areas', 'cube']);
    expect(groups.map((g) => g.label)).toEqual(['Bases', 'Skills', 'Modifiers', 'Materials', 'Areas', 'Cube recipes']);
    expect(groups[2]?.results).toEqual([{ name: 'Fire Resist', href: '/modifiers?kind=resist-fire' }]);
  });

  it('links a cube family label to its family id', () => {
    const [group] = searchHome('charm', {
      cube: [{ name: 'Upgrading, rerolling and recycling unique charms', id: 'unique-charm-upgrades' }],
    });
    expect(group?.results).toEqual([
      { name: 'Upgrading, rerolling and recycling unique charms', href: '/cube-recipes?family=unique-charm-upgrades' },
    ]);
  });

  it('collapses duplicated area names to one result', () => {
    const [group] = searchHome('jail', { areas: ['Jail Level 1', 'Jail Level 2', 'Jail Level 2'] });
    expect(group?.results).toEqual([
      { name: 'Jail Level 1', href: '/area-levels?search=%22Jail%20Level%201%22' },
      { name: 'Jail Level 2', href: '/area-levels?search=%22Jail%20Level%202%22' },
    ]);
  });
});

describe('areaSearchNames', () => {
  it('suffixes the act of names shared across acts and keeps one result per twin family', () => {
    const names = areaSearchNames([
      { id: 38, name: 'Tristram', act: 0 },
      { id: 48, name: 'Sewers Level 1', act: 1 },
      { id: 66, name: "Tal Rasha's Tomb", act: 1 },
      { id: 67, name: "Tal Rasha's Tomb", act: 1 },
      { id: 92, name: 'Sewers Level 1', act: 2 },
      { id: 136, name: 'Tristram', act: 4 },
    ]);
    expect(names).toEqual([
      { name: 'Tristram (Act I)', id: '38' },
      { name: 'Sewers Level 1 (Act II)', id: '48' },
      { name: "Tal Rasha's Tomb", id: '66' },
      { name: "Tal Rasha's Tomb", id: '67' },
      { name: 'Sewers Level 1 (Act III)', id: '92' },
      { name: 'Tristram (Act V)', id: '136' },
    ]);
    expect(rankNames(names, 'sewers level 1').map((entry) => homeResultHref('areas', entry))).toEqual([
      '/campaign-map?area=48',
      '/campaign-map?area=92',
    ]);
    expect(rankNames(names, 'tal rasha')).toEqual([{ name: "Tal Rasha's Tomb", id: '66' }]);
  });
});

describe('skillSearchNames', () => {
  it('suffixes the variant of skills sharing a name and keeps every id', () => {
    const names = skillSearchNames([
      { id: 'Amplify Damage', name: 'Amplify Damage' },
      { id: 'Amplify Damage Aura', name: 'Amplify Damage' },
      { id: 'Stormshield Chain Lightning', name: 'Chain Lightning' },
      { id: 'Chain Lightning Djinn', name: 'Chain Lightning' },
      { id: 'Teleport', name: 'Teleport' },
    ]);
    expect(names).toEqual([
      { name: 'Amplify Damage', id: 'Amplify Damage' },
      { name: 'Amplify Damage (Aura)', id: 'Amplify Damage Aura' },
      { name: 'Chain Lightning (Stormshield Chain Lightning)', id: 'Stormshield Chain Lightning' },
      { name: 'Chain Lightning (Djinn)', id: 'Chain Lightning Djinn' },
      { name: 'Teleport', id: 'Teleport' },
    ]);
    const [group] = searchHome('amplify', { skills: names });
    expect(group?.results.map((r) => r.href)).toEqual(['/skills?skill=Amplify%20Damage', '/skills?skill=Amplify%20Damage%20Aura']);
  });
});

describe('result links', () => {
  it('focuses the exact name on the list pages and phrase-searches bases', () => {
    expect(homeResultHref('runewords', 'Call to Arms')).toBe('/runewords?name=Call%20to%20Arms');
    expect(homeResultHref('gemwords', 'America')).toBe('/gemwords?name=America');
    expect(homeResultHref('uniques', "Artemis' Wrath")).toBe("/uniques?name=Artemis'%20Wrath");
    expect(homeResultHref('mythicals', 'X')).toBe('/mythicals?name=X');
    expect(homeResultHref('sets', "Arcanna's Tricks")).toBe("/sets?name=Arcanna's%20Tricks");
    expect(homeResultHref('setItems', "Arcanna's Sign")).toBe("/sets?name=Arcanna's%20Sign");
    expect(homeResultHref('bases', 'Ring Mail')).toBe('/bases?search=%22Ring%20Mail%22');
  });

  it('focuses a skill id, a material name, a cube family id, opens an area on the campaign map (phrase search without an id)', () => {
    expect(homeResultHref('skills', { name: 'Amplify Damage (Aura)', id: 'Amplify Damage Aura' })).toBe(
      '/skills?skill=Amplify%20Damage%20Aura'
    );
    expect(homeResultHref('materials', 'Small Charm')).toBe('/materials?name=Small%20Charm');
    expect(homeResultHref('areas', 'Catacombs Level 3')).toBe('/area-levels?search=%22Catacombs%20Level%203%22');
    expect(homeResultHref('areas', { name: 'Sewers Level 2', id: '93' })).toBe('/campaign-map?area=93');
    expect(homeResultHref('cube', { name: 'Opening map portals', id: 'map-portals' })).toBe('/cube-recipes?family=map-portals');
  });

  it('sends a free-text Enter to the runewords search', () => {
    expect(runewordsSearchHref(' life leech ')).toBe('/runewords?search=life%20leech');
  });
});
