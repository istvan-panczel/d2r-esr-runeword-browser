import { useEffect, useState } from 'react';
import { ChevronsUpDown, Play, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SOUND_FILE_EXTENSIONS } from '../../engine/validate';
import { useLootFilterData } from '../../hooks/useLootFilterData';
import { useSoundPreview } from '../../hooks/useSoundPreview';
import { BUNDLED_SOUND_ASSETS, bundledSoundUrl, findBundledSound, soundLabel } from '../../utils/bundledAssets';
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

/** `sound` combobox (bundled files + sounds.txt names, free text allowed), a play button and `soundVolume`. */
export function SoundField({ idPrefix, sound, soundVolume, filterVolume, onSoundChange, onVolumeChange }: SoundFieldProps) {
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
  const options = [
    ...BUNDLED_SOUND_ASSETS.map((asset) => ({ value: asset.file, label: asset.file, detail: 'bundled file' })),
    ...[...new Set(soundNames.filter((name) => name !== ''))].map((name) => ({ value: name, label: name, detail: 'sounds.txt' })),
  ];
  const matches = options.filter((option) => option.label.toLowerCase().includes(lower)).slice(0, MAX_RESULTS);
  const exact = options.some((option) => option.label.toLowerCase() === lower);

  const choose = (value: string | number) => {
    onSoundChange(value);
    setOpen(false);
    setQuery('');
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
      <Field id={`${idPrefix}-sound`} label="Sound">
        <div className="flex gap-1">
          <Popover
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setQuery('');
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
            <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Search, or type a file name or row number…" value={query} onValueChange={setQuery} />
                <CommandList>
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
                  {matches.length > 0 && (
                    <CommandGroup heading={gameData.status === 'loading' ? 'Sounds (loading sounds.txt…)' : 'Sounds'}>
                      {matches.map((option) => (
                        <CommandItem
                          key={`${option.detail}:${option.value}`}
                          value={`${option.detail}:${option.value}`}
                          onSelect={() => {
                            choose(option.value);
                          }}
                        >
                          <span className="truncate font-mono">{option.label}</span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{option.detail}</span>
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
          {sound !== undefined && (
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
