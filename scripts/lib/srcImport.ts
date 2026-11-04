/**
 * Imports app modules under src/ from a Node script. App code uses the `@/` alias (vite.config.ts) and extensionless
 * relative imports, which Node's type stripping does not resolve; a synchronous resolve hook maps both to the `.ts`
 * file. Type-only imports are erased by Node, so the browser-only modules they name are never loaded.
 */
import { existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REPO_ROOT } from './esrClone.ts';

const SRC_DIR = join(REPO_ROOT, 'src');
let registered = false;

function existingFile(target: string): string | null {
  for (const file of [target, `${target}.ts`, join(target, 'index.ts')]) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

function registerSrcResolver(): void {
  if (registered) return;
  registered = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      let target: string | null = null;
      if (specifier.startsWith('@/')) target = join(SRC_DIR, specifier.slice(2));
      else if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith('file:') === true) {
        const parent = fileURLToPath(context.parentURL);
        if (parent.startsWith(SRC_DIR)) target = resolve(dirname(parent), specifier);
      }
      const file = target === null ? null : existingFile(target);
      return nextResolve(file === null ? specifier : pathToFileURL(file).href, context);
    },
  });
}

/** Imports `src/<path>` (e.g. `core/navigation/navConfig.ts`); the caller states the shape it reads. */
export async function importSrc<T>(path: string): Promise<T> {
  registerSrcResolver();
  return (await import(pathToFileURL(join(SRC_DIR, path)).href)) as T;
}
