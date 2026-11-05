import { JsoncSyntaxError } from '../engine/jsonc';
import { parseLootFilter } from '../engine/parse';
import type { LootFilter, RuleActions } from '../engine/types';
import { findBundledIconAsset, findBundledSound } from './bundledAssets';
import { lootFilterAssetUrl } from './template';

/**
 * The sound and icon files a filter needs next to it: the plugin reads a `sound` file from the filter's `sounds`
 * folder and an `icon.iconName` from its `icons` folder (`<name>.sprite`). The launcher's Import copies only the
 * filter, so the zip download carries the bundled ones and names the rest.
 */

export interface BundledAssetFile {
  /** Path inside the filter folder (and the zip), e.g. `sounds/gong.mp3` or `icons/goldstar.sprite`. */
  readonly path: string;
  /** Where the app serves the file. */
  readonly url: string;
}

export interface ReferencedAssets {
  /** Files the app bundles (the `bundledAssets.ts` registry), in first-reference order (an icon brings its `.lowend.sprite` variant along). */
  readonly bundled: readonly BundledAssetFile[];
  /** Files the filter references that the app does not bundle (paths as above): the user must supply them. */
  readonly missing: readonly string[];
}

const SOUND_FILE = /\.(wav|mp3|flac)$/i;

/** A `sound` value that names a file (a sounds.txt name or row number does not). */
export function isSoundFile(sound: string | number | undefined): sound is string {
  return typeof sound === 'string' && SOUND_FILE.test(sound.trim());
}

/** Every `sound` file and `icon` the rules and styles reference, split into bundled and missing files. */
export function collectReferencedAssets(filter: LootFilter): ReferencedAssets {
  const bundled = new Map<string, BundledAssetFile>();
  const missing = new Map<string, string>();
  const addBundled = (path: string) => {
    bundled.set(path, { path, url: lootFilterAssetUrl(path.split('/').map(encodeURIComponent).join('/')) });
  };
  const addMissing = (path: string) => {
    const key = path.toLowerCase();
    if (!missing.has(key)) missing.set(key, path);
  };

  const visit = (actions: RuleActions) => {
    if (isSoundFile(actions.sound)) {
      const name = findBundledSound(actions.sound);
      if (name === undefined) addMissing(`sounds/${actions.sound.trim()}`);
      else addBundled(`sounds/${name}`);
    }
    const iconName = actions.icon?.iconName;
    if (iconName !== undefined && iconName.trim() !== '') {
      const asset = findBundledIconAsset(iconName);
      if (asset === undefined) addMissing(`icons/${iconName.trim().replace(/\.sprite$/i, '')}.sprite`);
      else {
        addBundled(`icons/${asset.name}.sprite`);
        if (asset.lowend === true) addBundled(`icons/${asset.name}.lowend.sprite`);
      }
    }
  };

  for (const style of Object.values(filter.styles ?? {})) visit(style);
  for (const rule of filter.rules) visit(rule);
  return { bundled: [...bundled.values()], missing: [...missing.values()] };
}

export const NO_ASSETS: ReferencedAssets = { bundled: [], missing: [] };

// Library cards re-render often; the texts rarely change. Keyed by the text itself, cleared when it grows large.
const cache = new Map<string, ReferencedAssets>();
const CACHE_LIMIT = 50;

/** The referenced assets of a filter file's text; none when the text is not valid JSON. */
export function referencedAssetsOfText(text: string): ReferencedAssets {
  const hit = cache.get(text);
  if (hit) return hit;
  if (cache.size >= CACHE_LIMIT) cache.clear();
  let assets = NO_ASSETS;
  try {
    assets = collectReferencedAssets(parseLootFilter(text).filter);
  } catch (error) {
    if (!(error instanceof JsoncSyntaxError)) throw error;
  }
  cache.set(text, assets);
  return assets;
}
