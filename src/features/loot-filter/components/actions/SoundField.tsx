import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Play, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SOUND_FILE_EXTENSIONS } from '../../engine/validate';
import { useLootFilterData } from '../../hooks/useLootFilterData';
import { useSoundPreview } from '../../hooks/useSoundPreview';
import { BUNDLED_SOUND_ASSETS, BUNDLED_SOUNDS, bundledSoundUrl, findBundledSound, soundLabel } from '../../utils/bundledAssets';
import { Field } from '../Field';
import { NumberInput } from '../NumberInput';

const MAX_RESULTS = 100;

interface SoundFieldProps {
  readonly idPrefix: string;
  readonly sound: string | number | undefined;
  readonly soundVolume: number | undefined;
  /** The filter's `soundVolume` (undefined = 100). */
  readonly filterVolume: number | undefined;
  readonly onSoundChange: (sound: string | number | undefined) => void;
  readonly onVolumeChange: (volume: number | undefined) => void;
  /** After the Sound and Volume labels (the "advanced" tag, the style mark). */
  readonly badge?: React.ReactNode;
  readonly volumeBadge?: React.ReactNode;
  /** The rule's style sets a sound: no remove button (a rule cannot remove a style's sound, only change it). */
  readonly fromStyle?: boolean;
}

function isSoundFile(sound: string): boolean {
  const lower = sound.toLowerCase();
  return SOUND_FILE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** A typed value: digits are a sounds.txt row number, anything else a name. */
function parseSound(text: string): string | number {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

/**
 * `sound` combobox (every bundled file with a play button, then the sounds.txt names; the search matches anywhere in
 * the text, free text allowed), a play button for the chosen file and `soundVolume`.
 */
export function SoundField({
  idPrefix,
  sound,
  soundVolume,
  filterVolume,
  onSoundChange,
  onVolumeChange,
  badge,
  volumeBadge,
  fromStyle = false,
}: SoundFieldProps) {
  const gameData = useLootFilterData();
  const soundNames = gameData.data?.sounds ?? [];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const preview = useSoundPreview();
  const [localFile, setLocalFile] = useState<{ readonly name: string; readonly url: string } | null>(null);

  // Revoke the object URL when the file is replaced or the field goes away.
  useEffect(() => {
    if (!localFile) return;
    const { url } = localFile;
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [localFile]);

  const volume = soundVolume ?? filterVolume ?? 100;
  const bundled = findBundledSound(sound);
  const bundledUrl = bundled === undefined ? undefined : bundledSoundUrl(bundled);

  const lower = query.trim().toLowerCase();
  // Every bundled file shows with an empty search (it matches its name, label or use anywhere); the game's sounds by name.
  const bundledMatches = BUNDLED_SOUND_ASSETS.filter((asset) => `${asset.file} ${asset.label} ${asset.use}`.toLowerCase().includes(lower));
  const gameSounds = [...new Set(soundNames.filter((name) => name !== ''))];
  const gameMatches = gameSounds.filter((name) => name.toLowerCase().includes(lower)).slice(0, MAX_RESULTS);
  const exact = [...BUNDLED_SOUNDS, ...gameSounds].some((name) => name.toLowerCase() === lower);
  const currentText = sound === undefined ? undefined : String(sound).toLowerCase();

  // Closing the list stops a preview started from it.
  const closeList = () => {
    setOpen(false);
    setQuery('');
    preview.stop();
  };

  const choose = (value: string | number) => {
    onSoundChange(value);
    closeList();
  };

  const togglePlay = (url: string) => {
    if (preview.playing === url) preview.stop();
    else preview.play(url, volume);
  };

  let previewNote: string | null = null;
  if (sound !== undefined && bundled === undefined) {
    previewNote =
      typeof sound === 'string' && isSoundFile(sound)
        ? 'Preview not available: your own file (pick it below to listen).'
        : "No preview: a game sound plays from the game's files.";
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
      <Field id={`${idPrefix}-sound`} label="Sound" badge={badge}>
        <div className="flex gap-1">
          <Popover
            open={open}
            onOpenChange={(next) => {
              if (next) setOpen(true);
              else closeList();
            }}
          >
            <PopoverTrigger asChild>
              <Button
                id={`${idPrefix}-sound`}
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="min-w-0 flex-1 justify-between font-normal"
              >
                <span className={cn('truncate font-mono', sound === undefined && 'font-sans text-muted-foreground')}>
                  {sound === undefined ? 'No sound' : soundLabel(sound, soundNames)}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Search, or type a file name or row number…" value={query} onValueChange={setQuery} />
                <CommandList className="max-h-[min(26rem,calc(var(--radix-popover-content-available-height)-2.5rem))]">
                  <CommandEmpty>Nothing found.</CommandEmpty>
                  {lower !== '' && !exact && (
                    <CommandGroup heading="Use as typed">
                      <CommandItem
                        value={`__typed:${query}`}
                        onSelect={() => {
                          choose(parseSound(query));
                        }}
                      >
                        <span className="font-mono">{query.trim()}</span>
                      </CommandItem>
                    </CommandGroup>
                  )}
                  {bundledMatches.length > 0 && (
                    <CommandGroup heading="Bundled sounds (they go into the .zip download)">
                      {bundledMatches.map((asset) => {
                        const url = bundledSoundUrl(asset.file);
                        const playing = preview.playing === url;
                        return (
                          <CommandItem
                            key={`bundled:${asset.file}`}
                            value={`bundled:${asset.file}`}
                            className="items-start"
                            onSelect={() => {
                              choose(asset.file);
                            }}
                          >
                            <Check
                              className={cn(
                                'mt-0.5 size-4 shrink-0',
                                currentText === asset.file.toLowerCase() ? 'opacity-100' : 'opacity-0'
                              )}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-mono">{asset.file}</span>
                              <span className="block text-xs text-muted-foreground">
                                {asset.label}: {asset.use}
                              </span>
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              className="shrink-0"
                              aria-label={playing ? 'Stop the sound' : `Play ${asset.file}`}
                              // Plays without picking the sound: the item's own pointer and click handling stay out of it.
                              onPointerDown={(event) => {
                                event.stopPropagation();
                              }}
                              // Enter on the focused button plays too: the list's own Enter would pick the highlighted sound.
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                              }}
                              onClick={(event) => {
                                event.stopPropagation();
                                togglePlay(url);
                              }}
                            >
                              {playing ? <Square /> : <Play />}
                            </Button>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}
                  {gameMatches.length > 0 && (
                    <CommandGroup
                      heading={
                        gameData.status === 'loading' ? 'Game sounds (loading sounds.txt…)' : 'Game sounds (sounds.txt, no file needed)'
                      }
                    >
                      {gameMatches.map((name) => (
                        <CommandItem
                          key={`game:${name}`}
                          value={`game:${name}`}
                          onSelect={() => {
                            choose(name);
                          }}
                        >
                          <Check
                            className={cn('size-4 shrink-0', currentText === name.toLowerCase() ? 'opacity-100' : 'opacity-0')}
                            aria-hidden
                          />
                          <span className="truncate font-mono">{name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {bundledUrl !== undefined && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={preview.playing === bundledUrl ? 'Stop the sound' : `Play ${bundled ?? ''} at volume ${String(volume)}`}
              onClick={() => {
                togglePlay(bundledUrl);
              }}
            >
              {preview.playing === bundledUrl ? <Square /> : <Play />}
            </Button>
          )}
          {sound !== undefined && !fromStyle && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove the sound"
              onClick={() => {
                onSoundChange(undefined);
              }}
            >
              <X />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          A .wav, .mp3 or .flac file in the <code>sounds</code> folder next to the filter (the bundled ones come from Sully&apos;s QoL), or
          one of the game&apos;s own sounds by its sounds.txt name or row, such as <code>item_rune</code>. sounds.txt is a table inside the
          mod&apos;s game data: you need no file, the game plays its own sound.
        </p>
        {previewNote !== null && <p className="text-xs text-muted-foreground">{previewNote}</p>}
        {preview.error !== null && <p className="text-xs text-destructive">{preview.error}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Label htmlFor={`${idPrefix}-sound-file`} className="text-xs font-normal text-muted-foreground">
            Preview a local file:
          </Label>
          <Input
            id={`${idPrefix}-sound-file`}
            type="file"
            accept="audio/*"
            className="h-8 w-auto max-w-full text-xs"
            onChange={(event) => {
              const file = event.target.files?.[0];
              preview.stop();
              setLocalFile(file ? { name: file.name, url: URL.createObjectURL(file) } : null);
            }}
          />
          {localFile && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                togglePlay(localFile.url);
              }}
            >
              {preview.playing === localFile.url ? <Square /> : <Play />}
              {preview.playing === localFile.url ? 'Stop' : `Play ${localFile.name}`}
            </Button>
          )}
        </div>
      </Field>
      <Field
        id={`${idPrefix}-sound-volume`}
        label="Volume"
        badge={volumeBadge}
        hint={soundVolume === undefined ? `Filter default (${String(filterVolume ?? 100)})` : '0 to 100'}
      >
        <NumberInput
          id={`${idPrefix}-sound-volume`}
          className="w-28"
          min={0}
          max={100}
          value={soundVolume}
          placeholder={String(filterVolume ?? 100)}
          onCommit={onVolumeChange}
        />
      </Field>
    </div>
  );
}
