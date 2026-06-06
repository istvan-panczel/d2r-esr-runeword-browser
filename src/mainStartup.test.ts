import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('application startup code splitting', () => {
  it('loads the heavy data sync saga dynamically before dispatching startup checks', () => {
    const source = readSource('src/core/startup.ts');

    expect(source).not.toContain("from '@/features/data-sync'");
    expect(source).toContain("import('@/features/data-sync')");
    expect(source).toContain('registerSaga(dataSyncSaga)');
    expect(source).toContain('runSagas()');
    expect(source).toContain('store.dispatch(startupCheck())');
  });

  it('keeps the entry module free of static data-sync imports', () => {
    const source = readSource('src/main.tsx');

    expect(source).not.toContain("from '@/features/data-sync'");
  });
});
