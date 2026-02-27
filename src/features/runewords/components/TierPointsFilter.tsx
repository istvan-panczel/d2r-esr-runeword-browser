import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { setMaxTierPoints, selectMaxTierPoints } from '../store/runewordsSlice';
import { getTierTextColor } from '../constants/tierColors';
import type { RuneCategory } from '@/core/db';

const INPUT_DEBOUNCE_MS = 300;

interface TierKeyConfig {
  readonly key: string;
  readonly tier: number;
  readonly category: RuneCategory;
  readonly label: string;
}

const TIER_KEYS: readonly TierKeyConfig[] = [
  { key: 'esrRunes:1', tier: 1, category: 'esrRunes', label: 'T1' },
  { key: 'esrRunes:2', tier: 2, category: 'esrRunes', label: 'T2' },
  { key: 'esrRunes:3', tier: 3, category: 'esrRunes', label: 'T3' },
  { key: 'esrRunes:4', tier: 4, category: 'esrRunes', label: 'T4' },
  { key: 'esrRunes:5', tier: 5, category: 'esrRunes', label: 'T5' },
  { key: 'esrRunes:6', tier: 6, category: 'esrRunes', label: 'T6' },
  { key: 'esrRunes:7', tier: 7, category: 'esrRunes', label: 'T7' },
  { key: 'lodRunes:1', tier: 1, category: 'lodRunes', label: 'LoD-L' },
  { key: 'lodRunes:2', tier: 2, category: 'lodRunes', label: 'LoD-M' },
  { key: 'lodRunes:3', tier: 3, category: 'lodRunes', label: 'LoD-H' },
];

function TierPointInput({ config }: { readonly config: TierKeyConfig }) {
  const dispatch = useDispatch();
  const maxTierPoints = useSelector(selectMaxTierPoints);
  const reduxValue = maxTierPoints[config.key] ?? null;
  const [localValue, setLocalValue] = useState(reduxValue);

  // Sync local state when Redux state changes externally
  useEffect(() => {
    setLocalValue(reduxValue);
  }, [reduxValue]);

  // Debounce dispatch to Redux
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== reduxValue) {
        dispatch(setMaxTierPoints({ tierKey: config.key, value: localValue }));
      }
    }, INPUT_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [localValue, reduxValue, config.key, dispatch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setLocalValue(null);
    } else {
      const num = parseInt(value, 10);
      if (num >= 0) {
        setLocalValue(num);
      }
    }
  };

  const handleClear = () => {
    setLocalValue(null);
    dispatch(setMaxTierPoints({ tierKey: config.key, value: null }));
  };

  const colorClass = getTierTextColor(config.tier, config.category);

  return (
    <div className="w-28">
      <span className={`text-xs font-medium ${colorClass}`}>{config.label} max</span>
      <InputGroup>
        <InputGroupInput
          type="number"
          min={0}
          placeholder={config.label}
          value={localValue ?? ''}
          onChange={handleChange}
          className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {localValue !== null && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton variant="ghost" size="icon-xs" onClick={handleClear} aria-label={`Clear ${config.label} max`}>
              <X className="size-3" />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  );
}

export function TierPointsFilter() {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Max tier points (leave empty for no limit).</p>
      <div className="flex flex-wrap gap-2">
        {TIER_KEYS.map((config) => (
          <TierPointInput key={config.key} config={config} />
        ))}
      </div>
    </div>
  );
}
