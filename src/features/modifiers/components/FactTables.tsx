import type { ModifierFact, ModifierFactValue } from '@/features/game-data/engine/schema';
import { formatFactValue, formatNumber } from '../utils/modifierPlaceholders';
import { groupFacts, recordKeyLabel } from '../utils/modifiersView';
import { DIFFICULTY_LABELS } from '../utils/calculatorViews';
import { FACT_ORIGIN_SOURCE } from '../utils/sourceKinds';
import { SourceBadge } from './SourceBadge';

const TABLE = 'w-full min-w-max border-collapse text-sm';
const TH = 'border-b px-2 py-1 text-left text-xs font-medium text-muted-foreground';
const TD = 'border-b border-border/50 px-2 py-1 align-top';

function unitSuffix(fact: ModifierFact): string {
  return fact.unit === 'percent' ? '%' : '';
}

function FactLabel({ fact }: { readonly fact: ModifierFact }) {
  return (
    <div className="max-w-xs space-y-0.5 whitespace-normal">
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-medium">{fact.label}</span>
        <SourceBadge tag={{ kind: FACT_ORIGIN_SOURCE[fact.origin] }} long />
      </div>
      <div className="font-mono text-[0.7rem] break-all text-muted-foreground">
        {fact.source.file} · {fact.source.key}
      </div>
    </div>
  );
}

function Value({ value, vanilla, suffix }: { readonly value: number; readonly vanilla: number | undefined; readonly suffix: string }) {
  return (
    <>
      <span className="font-medium tabular-nums">
        {formatNumber(value)}
        {suffix}
      </span>
      {vanilla !== undefined && vanilla !== value && (
        <span className="block text-xs text-muted-foreground tabular-nums">
          vanilla {formatNumber(vanilla)}
          {suffix}
        </span>
      )}
    </>
  );
}

function asNumbers(value: ModifierFactValue | undefined): readonly number[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'number') ? value : undefined;
}

function asRecord(value: ModifierFactValue | undefined): Readonly<Record<string, number>> | undefined {
  return typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}

function Notes({ facts }: { readonly facts: readonly ModifierFact[] }) {
  const notes = facts.filter((fact) => fact.note !== undefined);
  if (notes.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 px-2 text-xs text-muted-foreground">
      {notes.map((fact) => (
        <li key={fact.key}>
          <span className="font-medium">{fact.label}:</span> {fact.note}
        </li>
      ))}
    </ul>
  );
}

/** The card's numbers with provenance: per difficulty, per class / target, and single settings, ESR next to vanilla */
export function FactTables({ facts }: { readonly facts: readonly ModifierFact[] }) {
  const { perDifficulty, records, scalars } = groupFacts(facts);
  return (
    <div className="space-y-3">
      {perDifficulty.length > 0 && (
        <div>
          <div className="overflow-x-auto rounded-md border">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Per difficulty</th>
                  {DIFFICULTY_LABELS.map((label) => (
                    <th key={label} className={TH}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perDifficulty.map((fact) => {
                  const values = asNumbers(fact.value) ?? [];
                  const vanilla = asNumbers(fact.vanilla);
                  return (
                    <tr key={fact.key}>
                      <td className={TD}>
                        <FactLabel fact={fact} />
                      </td>
                      {values.map((value, index) => (
                        <td key={DIFFICULTY_LABELS[index]} className={TD}>
                          <Value value={value} vanilla={vanilla?.[index]} suffix={unitSuffix(fact)} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Notes facts={perDifficulty} />
        </div>
      )}

      {records.map((fact) => {
        const values = asRecord(fact.value) ?? {};
        const vanilla = asRecord(fact.vanilla);
        return (
          <div key={fact.key}>
            <div className="overflow-x-auto rounded-md border">
              <table className={TABLE}>
                <caption className="px-2 pt-1.5 text-left">
                  <FactLabel fact={fact} />
                </caption>
                <thead>
                  <tr>
                    <th className={TH} />
                    <th className={TH}>ESR</th>
                    {vanilla !== undefined && <th className={TH}>Vanilla</th>}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(values).map(([key, value]) => {
                    const vanillaValue: number | undefined = vanilla?.[key];
                    return (
                      <tr key={key}>
                        <td className={TD}>{recordKeyLabel(key)}</td>
                        <td className={`${TD} font-medium tabular-nums`}>
                          {formatNumber(value)}
                          {unitSuffix(fact)}
                        </td>
                        {vanilla !== undefined && (
                          <td className={`${TD} text-muted-foreground tabular-nums`}>
                            {vanillaValue === undefined ? '—' : `${formatNumber(vanillaValue)}${unitSuffix(fact)}`}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Notes facts={[fact]} />
          </div>
        );
      })}

      {scalars.length > 0 && (
        <div>
          <div className="overflow-x-auto rounded-md border">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Setting</th>
                  <th className={TH}>ESR</th>
                  <th className={TH}>Vanilla</th>
                </tr>
              </thead>
              <tbody>
                {scalars.map((fact) => (
                  <tr key={fact.key}>
                    <td className={TD}>
                      <FactLabel fact={fact} />
                    </td>
                    <td className={`${TD} font-medium tabular-nums`}>
                      {formatFactValue(fact.value)}
                      {typeof fact.value === 'number' ? unitSuffix(fact) : ''}
                    </td>
                    <td className={`${TD} text-muted-foreground tabular-nums`}>
                      {fact.vanilla === undefined
                        ? '—'
                        : `${formatFactValue(fact.vanilla)}${typeof fact.vanilla === 'number' ? unitSuffix(fact) : ''}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Notes facts={scalars} />
        </div>
      )}
    </div>
  );
}
