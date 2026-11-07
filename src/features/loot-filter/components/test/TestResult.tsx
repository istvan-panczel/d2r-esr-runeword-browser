import { EyeOff, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEFAULT_QUALITY_COLORS } from '../../engine/colors';
import type { EvaluationResult } from '../../engine/evaluate';
import { QUALITIES, type LabelColor } from '../../engine/types';
import type { LootFilterData } from '../../hooks/useLootFilterData';
import { useSoundPreview } from '../../hooks/useSoundPreview';
import { bundledSoundUrl, findBundledSound, soundLabel } from '../../utils/bundledAssets';
import { LabelPreview } from '../LabelPreview';
import { Section } from '../actions/Section';

interface TestResultProps {
  readonly data: LootFilterData;
  readonly result: EvaluationResult;
  /** 1 to 9: the game colours a label by quality before any `ÿc` code. */
  readonly quality: number;
  /** Shows "Rule N" for the hiding rule. */
  readonly onShowRule: (index: number) => void;
}

function Swatch({ color }: { readonly color: LabelColor }) {
  return (
    <span
      className="inline-block size-3 shrink-0 rounded-sm border align-middle"
      style={{ backgroundColor: `rgb(${String(color[0])} ${String(color[1])} ${String(color[2])})` }}
      aria-hidden
    />
  );
}

/** What the filter does to the item: the ground label, chat lines, sounds, minimap icon and droplight. */
export function TestResult({ data, result, quality, onShowRule }: TestResultProps) {
  const preview = useSoundPreview();
  const qualityName = quality >= 1 ? QUALITIES.at(quality - 1) : undefined;
  const defaultColor = qualityName === undefined ? '=' : DEFAULT_QUALITY_COLORS[qualityName].slice(2);
  const soundNames = data.data?.sounds ?? [];
  const { hiddenBy } = result;

  return (
    <div className="flex flex-col gap-3">
      {result.hidden ? (
        <div className="flex flex-col gap-2 rounded-md border border-red-600/40 bg-red-500/10 p-3 text-sm">
          <span className="flex items-center gap-2 font-medium text-red-700 dark:text-red-300">
            <EyeOff className="size-4" aria-hidden />
            Hidden: no ground label
          </span>
          <span className="text-xs text-muted-foreground">
            {hiddenBy === null ? (
              'No rule applied and the filter hides unmatched items.'
            ) : (
              <>
                By{' '}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    onShowRule(hiddenBy);
                  }}
                >
                  rule {hiddenBy + 1}
                </Button>
                .
              </>
            )}
          </span>
        </div>
      ) : (
        <Section dense title="Ground label">
          <LabelPreview text={result.name} background={result.labelBackground} border={result.labelBorder} defaultColor={defaultColor} />
          {!result.matched && <p className="text-xs text-muted-foreground">No rule applied: the game&apos;s own label.</p>}
          {result.shownBy !== null && (
            <p className="text-xs text-muted-foreground">
              Shown by{' '}
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => {
                  if (result.shownBy !== null) onShowRule(result.shownBy);
                }}
              >
                rule {result.shownBy + 1}
              </Button>
              : no later rule can hide it.
            </p>
          )}
        </Section>
      )}

      <Section dense title="Chat">
        {result.chatMessages.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing is printed.</p>
        ) : (
          // Chat lines have no identity of their own and are rebuilt on every evaluation, so the index is the key.
          result.chatMessages.map((line, index) => (
            // eslint-disable-next-line react-x/no-array-index-key -- see above
            <LabelPreview key={index} text={line} defaultColor="0" className="justify-start px-2 py-1.5 text-sm" />
          ))
        )}
      </Section>

      <Section dense title="Sound">
        {result.sounds.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sound.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {result.sounds.map((entry, index) => {
              const bundled = findBundledSound(entry.sound);
              const url = bundled === undefined ? undefined : bundledSoundUrl(bundled);
              return (
                // Same as the chat lines: the index is the key.
                // eslint-disable-next-line react-x/no-array-index-key -- see above
                <li key={index} className="flex items-center gap-2 text-sm">
                  {url !== undefined && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="size-7"
                      aria-label={preview.playing === url ? 'Stop the sound' : `Play ${soundLabel(entry.sound, soundNames)}`}
                      onClick={() => {
                        if (preview.playing === url) preview.stop();
                        else preview.play(url, entry.volume);
                      }}
                    >
                      {preview.playing === url ? <Square /> : <Play />}
                    </Button>
                  )}
                  <span className="min-w-0 truncate font-mono">{soundLabel(entry.sound, soundNames)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">volume {entry.volume}</span>
                </li>
              );
            })}
          </ul>
        )}
        {preview.error !== null && <p className="text-xs text-destructive">{preview.error}</p>}
      </Section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Section dense title="Minimap icon">
          {result.icon === null ? (
            <p className="text-xs text-muted-foreground">None.</p>
          ) : (
            <p className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="font-mono">{result.icon.iconName}</span>
              <span className="text-xs text-muted-foreground">
                {result.icon.iconSize === undefined ? 'file size' : `size ${String(result.icon.iconSize)}`}
              </span>
              {result.icon.color !== undefined && <Swatch color={result.icon.color} />}
            </p>
          )}
        </Section>
        <Section dense title="Droplight">
          {result.droplight === null ? (
            <p className="text-xs text-muted-foreground">None.</p>
          ) : (
            <p className="flex items-center gap-1.5 text-sm">
              {result.droplight.color === undefined ? (
                "The game's white beam"
              ) : (
                <>
                  <Swatch color={result.droplight.color} />
                  <span className="font-mono text-xs">[{result.droplight.color.join(', ')}]</span>
                </>
              )}
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
