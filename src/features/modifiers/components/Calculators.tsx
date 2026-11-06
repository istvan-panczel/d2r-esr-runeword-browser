import { useId, useState, type ReactNode } from 'react';
import { Calculator } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Pills } from '@/features/game-data/components/EnhanceParts';
import type { ModifierFact } from '@/features/game-data/engine/schema';
import { crushingBlowRows, hitChanceView, leechRows, magicFindRows, minimumUsefulLeech, parseNumberInput } from '../utils/calculatorViews';
import type { ModifierCalculator } from '../utils/modifierContentKinds';
import { hitCurve } from '../utils/modifierMath';
import { formatNumber, formatSmallPercent } from '../utils/modifierPlaceholders';

const TABLE = 'w-full min-w-max border-collapse text-sm';
const TH = 'border-b px-2 py-1 text-left text-xs font-medium text-muted-foreground';
const TD = 'border-b border-border/50 px-2 py-1 tabular-nums';

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly hint?: string;
}) {
  const id = useId();
  return (
    <div className="w-36 space-y-1">
      <label htmlFor={id} className="block text-xs font-medium">
        {label}
      </label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-8"
      />
      {hint !== undefined && <p className="text-[0.7rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CalculatorBox({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold">
        <Calculator className="size-4" aria-hidden />
        {title}
      </h4>
      {children}
    </section>
  );
}

function LeechCalculator({ facts, resource: initial }: { readonly facts: readonly ModifierFact[]; readonly resource: 'life' | 'mana' }) {
  const [resource, setResource] = useState<'life' | 'mana'>(initial);
  const [leechText, setLeechText] = useState('20');
  const [drainText, setDrainText] = useState('100');
  const leech = parseNumberInput(leechText, 0, 10_000, 0);
  const drain = parseNumberInput(drainText, 0, 100, 100);
  const rows = leechRows(leech, resource, drain, facts);
  const minimumHell = minimumUsefulLeech(resource, 2, facts);
  return (
    <CalculatorBox title="Leech per difficulty">
      <Pills
        label="Resource"
        options={[
          { value: 'life', label: 'Life leech' },
          { value: 'mana', label: 'Mana leech' },
        ]}
        value={resource}
        onChange={(value) => {
          setResource(value === 'mana' ? 'mana' : 'life');
        }}
      />
      <div className="flex flex-wrap gap-3">
        <NumberField label={`Item ${resource} leech %`} value={leechText} onChange={setLeechText} />
        <NumberField label="Target drain" value={drainText} onChange={setDrainText} hint="monstats Drain: 100 most, 0 none" />
      </div>
      <div className="overflow-x-auto rounded-md border bg-background">
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Difficulty</th>
              <th className={TH}>Divisor</th>
              <th className={TH}>Exact</th>
              <th className={TH}>Engine (1/64 %)</th>
              <th className={TH}>Per 1000 damage</th>
              <th className={TH}>Vanilla D2R</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.difficulty}>
                <td className={`${TD} font-medium`}>{row.difficulty}</td>
                <td className={TD}>
                  {formatNumber(row.divisor)}
                  {row.vanillaDivisor !== null && row.vanillaDivisor !== row.divisor && (
                    <span className="text-xs text-muted-foreground"> (vanilla {formatNumber(row.vanillaDivisor)})</span>
                  )}
                </td>
                <td className={TD}>{formatSmallPercent(row.exact)}</td>
                <td className={`${TD} font-medium`}>{formatSmallPercent(row.engine)}</td>
                <td className={TD}>{formatNumber(row.per1000, 1)}</td>
                <td className={`${TD} text-muted-foreground`}>{row.vanillaExact === null ? '—' : formatSmallPercent(row.vanillaExact)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Percent of the physical damage dealt that comes back as {resource}. The vanilla engine keeps leech in steps of 1/64 % after the
        divisor (Engine column)
        {minimumHell === null ? '' : `, so under ${String(minimumHell)}% item ${resource} leech gives nothing in Hell`}.{' '}
        <span className="font-medium text-amber-800 dark:text-amber-300">Unconfirmed:</span> some guides say D2R rounds any leech under 1 %
        after reductions down to 0, which would make most item leech useless in Hell. Check in game.
      </p>
    </CalculatorBox>
  );
}

function MagicFindCalculator({ facts }: { readonly facts: readonly ModifierFact[] }) {
  const [mfText, setMfText] = useState('300');
  const mf = parseNumberInput(mfText, 0, 100_000, 0);
  const rows = magicFindRows(mf, facts);
  return (
    <CalculatorBox title="Effective Magic Find">
      <NumberField label="Magic Find %" value={mfText} onChange={setMfText} />
      <div className="overflow-x-auto rounded-md border bg-background">
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Quality</th>
              <th className={TH}>ESR effective MF</th>
              <th className={TH}>of which ESR tail</th>
              <th className={TH}>Vanilla D2R</th>
              <th className={TH}>Diminishing constant</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.quality}>
                <td className={`${TD} font-medium`}>{row.label}</td>
                <td className={`${TD} font-medium`}>{formatNumber(row.esr)}%</td>
                <td className={TD}>{row.tail > 0 ? `+${formatNumber(row.tail)}%` : '—'}</td>
                <td className={`${TD} text-muted-foreground`}>{formatNumber(row.vanilla)}%</td>
                <td className={`${TD} text-muted-foreground`}>{row.dim === null ? 'none (full MF)' : formatNumber(row.dim)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Unique, set and rare rolls use dim × MF / (MF + dim) (whole numbers, as the engine computes them) plus ESR&apos;s soft tail, a share
        of your raw MF with no limit. The tail&apos;s rounding is assumed to follow the engine&apos;s integer maths.
      </p>
    </CalculatorBox>
  );
}

function HitChanceCalculator({ facts }: { readonly facts: readonly ModifierFact[] }) {
  const [arText, setArText] = useState('5000');
  const [defText, setDefText] = useState('1000');
  const attackRating = parseNumberInput(arText, 0, 100_000_000, 0);
  const defense = parseNumberInput(defText, 0, 100_000_000, 0);
  const view = hitChanceView(attackRating, defense, facts);
  const curve = hitCurve(facts);
  return (
    <CalculatorBox title="Chance to hit">
      <div className="flex flex-wrap gap-3">
        <NumberField label="Attack rating" value={arText} onChange={setArText} />
        <NumberField label="Target defense" value={defText} onChange={setDefText} hint="after −% target defense" />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Ratio</dt>
        <dd className="tabular-nums">{view.ratio === null ? 'no defense' : `×${formatNumber(view.ratio, 2)}`}</dd>
        <dt className="text-muted-foreground">ESR</dt>
        <dd className="font-semibold tabular-nums">{view.esr}%</dd>
        <dt className="text-muted-foreground">Vanilla D2R</dt>
        <dd className="text-muted-foreground tabular-nums">{view.vanilla}% (equal levels)</dd>
      </dl>
      <div className="overflow-x-auto rounded-md border bg-background">
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Chance (ESR)</th>
              {view.needed.map((row) => (
                <th key={row.chance} className={TH}>
                  {row.chance}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${TD} text-muted-foreground`}>Attack rating needed</td>
              {view.needed.map((row) => (
                <td key={row.chance} className={TD}>
                  {row.attackRating === null ? '—' : row.attackRating.toLocaleString('en-US')}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        ESR&apos;s curve uses attack rating / defense{curve.levelScaling === 0 ? ' only (no level scaling)' : ' and the levels'}, limited to{' '}
        {curve.minChance}–{curve.maxChance} %. The config only says the late tail is &quot;blended in smoothly&quot;; a smoothstep blend
        reproduces the mod author&apos;s own table.
      </p>
    </CalculatorBox>
  );
}

function CrushingBlowCalculator({ facts }: { readonly facts: readonly ModifierFact[] }) {
  const [lifeText, setLifeText] = useState('10000');
  const [resistText, setResistText] = useState('0');
  const [playersText, setPlayersText] = useState('1');
  const [ranged, setRanged] = useState(false);
  const inputs = {
    currentLife: parseNumberInput(lifeText, 0, 1_000_000_000, 0),
    physicalResist: parseNumberInput(resistText, -1000, 100, 0),
    players: parseNumberInput(playersText, 1, 8, 1),
    ranged,
  };
  const rows = crushingBlowRows(inputs, facts);
  const commentMismatch = facts.find((fact) => fact.key === 'crushingBlow.share')?.note?.includes('disagree') === true;
  return (
    <CalculatorBox title="Crushing Blow per target">
      <div className="flex flex-wrap gap-3">
        <NumberField label="Target current life" value={lifeText} onChange={setLifeText} />
        <NumberField label="Target physical resist %" value={resistText} onChange={setResistText} hint="negative does not add" />
        <NumberField label="Players (/players)" value={playersText} onChange={setPlayersText} hint="1–8, monsters only" />
      </div>
      <Pills
        label="Attack"
        options={[
          { value: 'melee', label: 'Melee' },
          { value: 'ranged', label: 'Ranged' },
        ]}
        value={ranged ? 'ranged' : 'melee'}
        onChange={(value) => {
          setRanged(value === 'ranged');
        }}
      />
      <div className="overflow-x-auto rounded-md border bg-background">
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Target</th>
              <th className={TH}>Share of current life</th>
              <th className={TH}>Life removed</th>
              <th className={TH}>Vanilla D2R</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.target}>
                <td className={`${TD} font-medium`}>{row.label}</td>
                <td className={TD}>{formatSmallPercent(row.share)}</td>
                <td className={`${TD} font-medium`}>{Math.floor(row.damage).toLocaleString('en-US')}</td>
                <td className={`${TD} text-muted-foreground`}>
                  {formatSmallPercent(row.vanillaShare)} = {Math.floor(row.vanillaDamage).toLocaleString('en-US')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        One successful Crushing Blow. Against monsters the share is divided by the /players life bonus; physical resist reduces it (vanilla
        rule, kept by ESR).
        {commentMismatch && (
          <>
            {' '}
            <span className="font-medium text-amber-800 dark:text-amber-300">Unconfirmed:</span> some config comments disagree with their
            values (see the share table&apos;s note); the table uses the values the plugin reads.
          </>
        )}
      </p>
    </CalculatorBox>
  );
}

/** The calculators of one card */
export function ModifierCalculators({
  calculators,
  facts,
  leechResource,
}: {
  readonly calculators: readonly ModifierCalculator[];
  readonly facts: readonly ModifierFact[];
  readonly leechResource: 'life' | 'mana';
}) {
  return (
    <div className="space-y-3">
      {calculators.map((calculator) => {
        switch (calculator) {
          case 'leech':
            return <LeechCalculator key={calculator} facts={facts} resource={leechResource} />;
          case 'magic-find':
            return <MagicFindCalculator key={calculator} facts={facts} />;
          case 'hit-chance':
            return <HitChanceCalculator key={calculator} facts={facts} />;
          case 'crushing-blow':
            return <CrushingBlowCalculator key={calculator} facts={facts} />;
        }
      })}
    </div>
  );
}
