import { Link } from 'react-router-dom';
import type { BaseItem, SuperiorAffixes } from '../engine/schema';
import { superiorRollsForBase } from '../engine/superiorAffixes';
import { superiorAffixesPath } from '../utils/superiorView';
import { SuperiorRollList } from './SuperiorRollList';

interface SuperiorRollsSectionProps {
  readonly superior: SuperiorAffixes;
  readonly base: BaseItem;
}

/** Collapsed "Superior rolls" panel of a base card: the rows this exact base can roll, with their chances. */
export function SuperiorRollsSection({ superior, base }: SuperiorRollsSectionProps) {
  const { rolls } = superiorRollsForBase(superior, base);
  if (rolls.length === 0) return null;

  return (
    <details className="mt-2 text-sm">
      <summary
        className="cursor-pointer text-muted-foreground"
        title="A Superior item rolls one of these rows; its values stay when you make a runeword in it"
      >
        Superior rolls: one of {rolls.length}, kept in runewords
      </summary>
      <SuperiorRollList rolls={rolls} compact className="mt-1" />
      <Link to={superiorAffixesPath(base.type)} className="mt-1 inline-block text-primary underline-offset-2 hover:underline">
        All superior rows
      </Link>
    </details>
  );
}
