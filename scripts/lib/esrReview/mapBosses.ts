/**
 * Map bosses vs the official Endgame Maps page: the rewards in areas.json `mapBosses` come from the treasure classes, the
 * page's figures are hand-written in src/features/campaign-map/data/mapBosses.ts (`page`) and the Boss panel and the
 * endgame-bosses guide note show where the two differ. This check lists those differences at HEAD and in the working
 * tree (both against the working tree's hand-written facts), so a release that moves a chance shows up here.
 */
import type { MapBoss } from '../../../src/features/game-data/engine/schema.ts';
import { capLines, finding, info, ok, type Check } from './report.ts';

/** What the check reads of a boss card (`BossCard` of src/features/campaign-map/utils/mapBossFacts.ts) */
export interface BossCardLike {
  readonly uncurated: boolean;
  readonly rewards: readonly { readonly label: string; readonly chance: string; readonly official: string | null }[];
  readonly terror: string;
  readonly terrorUnconfirmed: boolean;
}

/**
 * `bossCard` of mapBossFacts.ts, passed in: the campaign map code uses the `@/` alias, which the scripts' type check
 * does not resolve, so the CLI loads it with importSrc.
 */
export type BossCardOf<F> = (boss: MapBoss, facts: F | undefined, here: boolean, nameOfBoss: (id: string) => string) => BossCardLike;

/** The bundle's map bosses (areas.json `mapBosses`); empty for a missing or malformed section. */
export function mapBossesOf(areas: Readonly<Record<string, unknown>> | null): MapBoss[] {
  const value = areas?.mapBosses;
  return Array.isArray(value) ? (value as MapBoss[]) : [];
}

/**
 * One line per place the files and the page disagree: a reward whose chance or tier differs from `page`, a terrorized
 * line the page contradicts, and a boss without a hand-written entry.
 */
export function mapBossPageLines<F>(bosses: readonly MapBoss[], facts: Readonly<Record<string, F>>, bossCard: BossCardOf<F>): string[] {
  const names = new Map(bosses.map((boss) => [boss.id, boss.name]));
  const lines: string[] = [];
  for (const boss of bosses) {
    const card = bossCard(boss, Object.hasOwn(facts, boss.id) ? facts[boss.id] : undefined, false, (id) => names.get(id) ?? id);
    if (card.uncurated) {
      lines.push(`${boss.name} (${boss.id}): no entry in data/mapBosses.ts`);
      continue;
    }
    for (const reward of card.rewards) {
      if (reward.official !== null) lines.push(`${boss.name}: ${reward.label} ${reward.chance} in the files, page: ${reward.official}`);
    }
    if (card.terrorUnconfirmed) lines.push(`${boss.name}: terrorized: ${card.terror}`);
  }
  return lines;
}

export function mapBossPageCheck(before: readonly string[], after: readonly string[]): Check {
  const id = 'mapbosses.page';
  const title = 'Map bosses vs the Endgame Maps page';
  const old = new Set(before);
  const now = new Set(after);
  const added = after.filter((line) => !old.has(line));
  const removed = before.filter((line) => !now.has(line));
  const lines = capLines([...added.map((line) => `+ ${line}`), ...removed.map((line) => `- ${line}`)]);
  if (added.length > 0) {
    return finding(
      id,
      title,
      `${String(added.length)} new differences between the files' map boss rewards and the page figures in data/mapBosses.ts (${String(after.length)} in all)`,
      'the Boss panel and the endgame-bosses note now print "page: …" next to these rewards; if docs/endgame_maps.htm changed too, update the `page` figures, else it is a page-vs-files mismatch to report',
      lines
    );
  }
  if (removed.length > 0) {
    return info(
      id,
      title,
      `${String(removed.length)} differences gone (the files now match the page, or the boss changed); check that content/guide/notes/endgame-bosses.md does not quote them.`,
      lines
    );
  }
  return ok(id, title, `Same ${String(after.length)} differences as HEAD.`);
}
