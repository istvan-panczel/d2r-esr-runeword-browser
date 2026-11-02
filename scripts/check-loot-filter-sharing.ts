#!/usr/bin/env node
/**
 * API-level verification of supabase/migrations/005_loot_filters.sql (RLS, column grants, triggers, the download RPC)
 * against the DEV Supabase project, as the app would talk to it: the anon key plus two signed-in test users.
 *
 *   npm run check:loot-filter-sharing
 *
 * Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.development and DEV_TEST_USER_{A,B}_{EMAIL,PASSWORD}
 * (plus PROD_SUPABASE_URL, if set) from .env.local. Refuses to run against PROD. Prints check names and PASS/FAIL only
 * (no keys, tokens, passwords, emails or URLs). Deletes every loot filter of test users A and B before and after the
 * run. Users and profiles are never touched (the profile cascade is not tested).
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, LootFilterInsert, LootFilterRow, LootFilterUpdate } from '../src/core/supabase/types.ts';

type Client = SupabaseClient<Database>;
interface Credentials {
  email: string;
  password: string;
}
interface Result<T> {
  data: T | null;
  error: { code?: string; message: string } | null;
}

const ROOT = join(import.meta.dirname, '..');
const PREFIX = 'check-loot-filter-sharing';
const SMALL = '{"rules":[]}';
const MAX_CONTENT_BYTES = 524288;
const MAX_FILTERS = 50;
const EMBED = 'profiles!loot_filters_user_id_fkey(display_name, discriminator, avatar_url)';

// ---------------------------------------------------------------------------
// Config and output hygiene
// ---------------------------------------------------------------------------

function abort(message: string): never {
  console.error(`${PREFIX}: ${message}`);
  process.exit(1);
}

function readEnvFile(name: string): NodeJS.Dict<string> {
  const path = join(ROOT, name);
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
}

const normalizeUrl = (url: string): string => url.trim().replace(/\/+$/, '').toLowerCase();

function loadConfig(): { url: string; anonKey: string; userA: Credentials; userB: Credentials } {
  const dev = readEnvFile('.env.development');
  const local = readEnvFile('.env.local');
  const prod = readEnvFile('.env.production');
  const missing: string[] = [];
  const need = (env: NodeJS.Dict<string>, key: string, file: string): string => {
    const value = env[key]?.trim() ?? '';
    if (value === '') missing.push(`${key} (${file})`);
    return value;
  };
  const url = need(dev, 'VITE_SUPABASE_URL', '.env.development');
  const anonKey = need(dev, 'VITE_SUPABASE_ANON_KEY', '.env.development');
  const userA = {
    email: need(local, 'DEV_TEST_USER_A_EMAIL', '.env.local'),
    password: need(local, 'DEV_TEST_USER_A_PASSWORD', '.env.local'),
  };
  const userB = {
    email: need(local, 'DEV_TEST_USER_B_EMAIL', '.env.local'),
    password: need(local, 'DEV_TEST_USER_B_PASSWORD', '.env.local'),
  };
  if (missing.length > 0) abort(`missing required variables: ${missing.join(', ')}`);

  // Never PROD: compare with PROD_SUPABASE_URL (.env.local) and the committed .env.production URL.
  const prodUrls = [local.PROD_SUPABASE_URL, prod.VITE_SUPABASE_URL].filter((u): u is string => !!u?.trim()).map(normalizeUrl);
  if (prodUrls.includes(normalizeUrl(url))) abort('VITE_SUPABASE_URL in .env.development points at PROD. Refusing to run.');
  if (userA.email.toLowerCase() === userB.email.toLowerCase()) abort('test users A and B must be different accounts.');
  return { url, anonKey, userA, userB };
}

// Values that must never reach the output; filled once the config and sessions are known.
const secrets: string[] = [];

function clean(text: string): string {
  let out = text;
  for (const secret of secrets) if (secret.length >= 4) out = out.split(secret).join('<redacted>');
  out = out
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/eyJ[\w-]*\.[\w-]*(\.[\w-]*)?/g, '<token>')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '<email>')
    .replace(/[\w-]{32,}/g, '<token>');
  return out.length > 200 ? `${out.slice(0, 200)}...` : out;
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String(error.message);
  return String(error);
}

// ---------------------------------------------------------------------------
// Check runner and helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed++;
    console.log(`FAIL  ${name}: ${clean(describe(error))}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function got<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`${label} missing (an earlier check failed)`);
  return value;
}

function ok<T>(res: Result<T>, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.code ?? ''} ${res.error.message}`);
  if (res.data === null) throw new Error(`${what}: no data`);
  return res.data;
}

/** The attempt must fail: an error, or (for filtered update / delete / select) zero rows. */
function rejected(res: Result<unknown>): boolean {
  return res.error !== null || (Array.isArray(res.data) && res.data.length === 0);
}

const errorCode = (res: Result<unknown>): string => res.error?.code ?? 'no error';

function newClient(url: string, anonKey: string): Client {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signIn(client: Client, user: Credentials, label: string): Promise<string> {
  const { data, error } = await client.auth.signInWithPassword(user);
  if (error) abort(`sign-in as test user ${label} failed: ${clean(error.message)}`);
  secrets.push(data.session.access_token, data.session.refresh_token);
  return data.user.id;
}

function filter(userId: string, name: string, extra: Partial<LootFilterInsert> = {}): LootFilterInsert {
  return { user_id: userId, name: `${PREFIX} ${name}`, content: SMALL, ...extra };
}

async function insertAs(client: Client, row: LootFilterInsert): Promise<LootFilterRow> {
  return ok(await client.from('loot_filters').insert(row).select('*').single(), 'insert');
}

async function updateAs(client: Client, id: string, patch: LootFilterUpdate): Promise<LootFilterRow> {
  const rows: LootFilterRow[] = ok(await client.from('loot_filters').update(patch).eq('id', id).select('*'), 'update');
  assert(rows.length === 1, `update matched ${String(rows.length)} rows`);
  return rows[0];
}

async function rowAs(client: Client, id: string): Promise<LootFilterRow | null> {
  const res = await client.from('loot_filters').select('*').eq('id', id).maybeSingle();
  if (res.error) throw new Error(`select: ${res.error.code} ${res.error.message}`);
  return res.data;
}

async function mustRow(client: Client, id: string): Promise<LootFilterRow> {
  const row = await rowAs(client, id);
  assert(row, 'row not visible to its owner');
  return row;
}

async function download(client: Client, id: string): Promise<void> {
  const res = await client.rpc('increment_loot_filter_download', { filter_id: id });
  if (res.error) throw new Error(`rpc: ${res.error.code} ${res.error.message}`);
}

async function likesVisible(client: Client, filterId: string): Promise<number> {
  return ok(await client.from('loot_filter_likes').select('user_id').eq('filter_id', filterId), 'select likes').length;
}

async function cleanup(a: Client, idA: string, b: Client, idB: string): Promise<boolean> {
  let allOk = true;
  for (const [client, userId, label] of [
    [a, idA, 'A'],
    [b, idB, 'B'],
  ] as const) {
    const res = await client.from('loot_filters').delete().eq('user_id', userId);
    if (res.error) {
      allOk = false;
      console.log(`WARN  cleanup of user ${label}'s loot filters failed: ${clean(res.error.message)}`);
    }
  }
  return allOk;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

async function runChecks(a: Client, b: Client, anon: Client, idA: string, idB: string): Promise<void> {
  const s: { pub?: LootFilterRow; priv?: LootFilterRow; toggle?: LootFilterRow } = {};
  const pubId = (): string => got(s.pub, 'public filter').id;

  await check('1  A inserts a public filter; revision 1, likes 0, downloads 0, not private', async () => {
    s.pub = await insertAs(a, filter(idA, 'public', { esr_version: '3.2.24', plugin_version: '0.6.11' }));
    const { revision, likes_count, download_count, is_private } = s.pub;
    assert(
      revision === 1 && likes_count === 0 && download_count === 0 && !is_private,
      `got ${JSON.stringify({ revision, likes_count, download_count, is_private })}`
    );
  });

  await check('2  private filter: hidden from anon and B, visible to A', async () => {
    s.priv = await insertAs(a, filter(idA, 'private', { is_private: true }));
    const id = s.priv.id;
    assert((await rowAs(anon, id)) === null, 'anon sees it');
    assert((await rowAs(b, id)) === null, 'B sees it');
    assert((await rowAs(a, id)) !== null, 'A does not see it');
  });

  await check('3  anon and B see the public filter; list query with the author embed works (no PGRST201)', async () => {
    for (const [client, label] of [
      [anon, 'anon'],
      [b, 'B'],
    ] as const) {
      const res = await client
        .from('loot_filters')
        .select(`id, name, likes_count, created_at, ${EMBED}`)
        .eq('user_id', idA)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      const rows = ok(res, `${label} list`) as unknown as { id: string; profiles: { display_name: string } | null }[];
      const pubRow = rows.find((r) => r.id === pubId());
      assert(pubRow, `${label} does not see the public filter`);
      assert(typeof pubRow.profiles?.display_name === 'string', `${label}: author embed is empty`);
      assert(!rows.some((r) => r.id === s.priv?.id), `${label} list contains the private filter`);
    }
  });

  await check('4a content update bumps revision to 2 and moves updated_at', async () => {
    const before = await mustRow(a, pubId());
    const after = await updateAs(a, before.id, { content: '{"rules":[1]}' });
    assert(after.revision === 2, `revision ${String(after.revision)}`);
    assert(after.updated_at !== before.updated_at, 'updated_at did not move');
  });

  await check('4b name-only update keeps revision and moves updated_at; a no-op update keeps updated_at', async () => {
    const before = await mustRow(a, pubId());
    const renamed = await updateAs(a, before.id, { name: `${PREFIX} public renamed` });
    assert(renamed.revision === before.revision, `revision moved to ${String(renamed.revision)}`);
    assert(renamed.updated_at !== before.updated_at, 'updated_at did not move on rename');
    const same = await updateAs(a, before.id, { name: renamed.name });
    assert(same.updated_at === renamed.updated_at, 'updated_at moved on a no-op update');
  });

  await check('4c compare-and-swap: stale revision updates 0 rows, current revision succeeds', async () => {
    const id = pubId();
    const stale = await a.from('loot_filters').update({ content: '{"rules":[2]}' }).eq('id', id).eq('revision', 1).select('revision');
    assert(ok(stale, 'stale CAS').length === 0, 'stale CAS updated a row');
    const current = ok(
      await a.from('loot_filters').update({ content: '{"rules":[3]}' }).eq('id', id).eq('revision', 2).select('revision'),
      'CAS'
    );
    assert(current.length === 1 && current[0].revision === 3, `current CAS gave ${JSON.stringify(current)}`);
  });

  const protectedUpdates: [keyof LootFilterRow, unknown][] = [
    ['revision', 99],
    ['likes_count', 99],
    ['download_count', 99],
    ['user_id', idB],
    ['created_at', '2000-01-01T00:00:00Z'],
    ['updated_at', '2000-01-01T00:00:00Z'],
    ['based_on_id', null],
    ['based_on_template', 'tampered'],
    ['esr_version', 'tampered'],
    ['plugin_version', 'tampered'],
    ['id', randomUUID()],
  ];
  for (const [column, value] of protectedUpdates) {
    await check(`5  A cannot update ${column}`, async () => {
      const id = pubId();
      const before = await mustRow(a, id);
      const attempt = column === 'based_on_id' ? got(s.priv, 'private filter').id : value;
      const res = await a
        .from('loot_filters')
        .update({ [column]: attempt } as never)
        .eq('id', id)
        .select('id');
      const after = await mustRow(a, id);
      assert(res.error !== null || after[column] === before[column], `${column} changed (no error)`);
    });
  }

  const protectedInserts: [keyof LootFilterRow, unknown][] = [
    ['revision', 5],
    ['likes_count', 5],
    ['download_count', 5],
    ['id', randomUUID()],
    ['created_at', '2000-01-01T00:00:00Z'],
    ['updated_at', '2000-01-01T00:00:00Z'],
  ];
  for (const [column, value] of protectedInserts) {
    await check(`5  A cannot insert with ${column}`, async () => {
      const res = await a
        .from('loot_filters')
        .insert({ ...filter(idA, `protected ${column}`), [column]: value } as never)
        .select('id');
      if (res.data) for (const row of res.data) await a.from('loot_filters').delete().eq('id', row.id);
      assert(res.error !== null, 'insert succeeded');
    });
  }

  await check("6  B cannot update or delete A's filter, nor insert one as A", async () => {
    const id = pubId();
    const before = await mustRow(a, id);
    assert(rejected(await b.from('loot_filters').update({ name: 'hijacked' }).eq('id', id).select('id')), 'B updated it');
    assert(rejected(await b.from('loot_filters').delete().eq('id', id).select('id')), 'B deleted it');
    const after = await mustRow(a, id);
    assert(after.name === before.name, 'name changed');
    const asOther = await b.from('loot_filters').insert(filter(idA, 'spoofed owner')).select('id');
    assert(asOther.error !== null, 'B inserted a row owned by A');
  });

  await check('6  anon cannot insert, update or delete', async () => {
    const id = pubId();
    assert((await anon.from('loot_filters').insert(filter(idA, 'anon')).select('id')).error !== null, 'anon inserted');
    assert(rejected(await anon.from('loot_filters').update({ name: 'anon' }).eq('id', id).select('id')), 'anon updated');
    assert(rejected(await anon.from('loot_filters').delete().eq('id', id).select('id')), 'anon deleted');
  });

  await check('7a B likes the public filter: likes_count 1, updated_at unchanged; a second like fails', async () => {
    const id = pubId();
    const before = await mustRow(a, id);
    ok(await b.from('loot_filter_likes').insert({ filter_id: id, user_id: idB }).select('filter_id'), 'like');
    const after = await mustRow(a, id);
    assert(after.likes_count === before.likes_count + 1, `likes_count ${String(after.likes_count)}`);
    assert(after.updated_at === before.updated_at, 'updated_at moved on a like');
    const again = await b.from('loot_filter_likes').insert({ filter_id: id, user_id: idB });
    assert(again.error?.code === '23505', `double like: ${errorCode(again)}`);
    assert((await likesVisible(anon, id)) === 1, 'anon does not see the like');
  });

  await check('7b B unlikes: likes_count back to 0', async () => {
    const id = pubId();
    ok(await b.from('loot_filter_likes').delete().eq('filter_id', id).eq('user_id', idB).select('filter_id'), 'unlike');
    const after = await mustRow(a, id);
    assert(after.likes_count === 0, `likes_count ${String(after.likes_count)}`);
  });

  await check('7c B cannot like the private filter, nor like as A; anon cannot like', async () => {
    const res = await b.from('loot_filter_likes').insert({ filter_id: got(s.priv, 'private filter').id, user_id: idB });
    assert(res.error !== null, 'B liked a private filter');
    assert((await b.from('loot_filter_likes').insert({ filter_id: pubId(), user_id: idA })).error !== null, 'B liked as A');
    assert((await anon.from('loot_filter_likes').insert({ filter_id: pubId(), user_id: idB })).error !== null, 'anon liked');
  });

  await check('7d likes of a filter that goes private are hidden from B and anon, kept, and visible again when public', async () => {
    s.toggle = await insertAs(a, filter(idA, 'toggle'));
    const id = s.toggle.id;
    ok(await b.from('loot_filter_likes').insert({ filter_id: id, user_id: idB }).select('filter_id'), 'like');
    await updateAs(a, id, { is_private: true });
    assert((await likesVisible(b, id)) === 0, 'B sees likes of a private filter');
    assert((await likesVisible(anon, id)) === 0, 'anon sees likes of a private filter');
    assert((await likesVisible(a, id)) === 1, 'A does not see the like on their private filter');
    await updateAs(a, id, { is_private: false });
    assert((await likesVisible(b, id)) === 1, 'like not visible again');
    assert((await mustRow(a, id)).likes_count === 1, 'likes_count lost');
  });

  await check('8a download RPC: anon and B each add 1 to the public filter, updated_at unchanged', async () => {
    const id = pubId();
    const before = await mustRow(a, id);
    await download(anon, id);
    await download(b, id);
    const after = await mustRow(a, id);
    assert(
      after.download_count === before.download_count + 2,
      `download_count ${String(before.download_count)} -> ${String(after.download_count)}`
    );
    assert(after.updated_at === before.updated_at, 'updated_at moved on a download');
  });

  await check('8b download RPC: no effect on a private filter for B and anon; A can count their own', async () => {
    const id = got(s.priv, 'private filter').id;
    const before = await mustRow(a, id);
    // An error is as good as a silent no-op here, so the results are not inspected.
    for (const client of [b, anon]) await client.rpc('increment_loot_filter_download', { filter_id: id });
    assert((await mustRow(a, id)).download_count === before.download_count, 'B or anon counted a private filter');
    await download(a, id);
    assert((await mustRow(a, id)).download_count === before.download_count + 1, 'A could not count their own private filter');
  });

  await check('9  content over 512 KiB is rejected, exactly 512 KiB is accepted', async () => {
    const over = await a
      .from('loot_filters')
      .insert(filter(idA, 'too big', { content: 'x'.repeat(MAX_CONTENT_BYTES + 1) }))
      .select('id');
    if (over.data) for (const row of over.data) await a.from('loot_filters').delete().eq('id', row.id);
    assert(over.error !== null, 'oversize content accepted');
    const exact = await insertAs(a, filter(idA, 'max size', { content: 'x'.repeat(MAX_CONTENT_BYTES) }));
    await a.from('loot_filters').delete().eq('id', exact.id);
  });

  await check('9  a 101-character name and an empty name are rejected', async () => {
    for (const name of ['n'.repeat(101), '']) {
      const res = await a.from('loot_filters').insert({ user_id: idA, name, content: SMALL }).select('id');
      if (res.data) for (const row of res.data) await a.from('loot_filters').delete().eq('id', row.id);
      assert(res.error !== null, `name of ${String(name.length)} characters accepted`);
    }
  });

  await check(`10 A can have at most ${String(MAX_FILTERS)} filters (loot_filter_limit)`, async () => {
    const counted = await a.from('loot_filters').select('id', { count: 'exact', head: true }).eq('user_id', idA);
    if (counted.error || counted.count === null) throw new Error(`count: ${counted.error?.message ?? 'no count'}`);
    const fill = Array.from({ length: MAX_FILTERS - counted.count }, (_, i) => filter(idA, `cap ${String(i + 1)}`));
    const fillIds: string[] = [];
    try {
      if (fill.length > 0) fillIds.push(...ok(await a.from('loot_filters').insert(fill).select('id'), 'fill to the cap').map((r) => r.id));
      const over = await a.from('loot_filters').insert(filter(idA, 'over the cap')).select('id');
      if (over.data) fillIds.push(...over.data.map((r) => r.id));
      assert(over.error?.message.includes('loot_filter_limit'), `51st insert: ${over.error?.message ?? 'succeeded'}`);
    } finally {
      if (fillIds.length > 0) await a.from('loot_filters').delete().in('id', fillIds);
    }
  });

  await check('11 B copies the public filter; when A deletes the source, based_on_id is nulled and updated_at kept', async () => {
    const source = await mustRow(a, pubId());
    const copy = await insertAs(
      b,
      filter(idB, 'copy', {
        content: source.content,
        based_on_id: source.id,
        based_on_revision: source.revision,
        based_on_label: 'public by A',
      })
    );
    assert(copy.based_on_id === source.id && copy.based_on_revision === source.revision, 'based_on not stored');
    assert(ok(await a.from('loot_filters').delete().eq('id', source.id).select('id'), 'delete source').length === 1, 'source not deleted');
    s.pub = undefined;
    const after = await mustRow(b, copy.id);
    assert(after.based_on_id === null, 'based_on_id not nulled');
    assert(after.based_on_revision === source.revision, 'based_on_revision changed');
    assert(after.updated_at === copy.updated_at, 'updated_at moved on the source delete');
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const config = loadConfig();
  secrets.push(config.url, config.anonKey, config.userA.email, config.userA.password, config.userB.email, config.userB.password);

  const anon = newClient(config.url, config.anonKey);
  const a = newClient(config.url, config.anonKey);
  const b = newClient(config.url, config.anonKey);
  const idA = await signIn(a, config.userA, 'A');
  const idB = await signIn(b, config.userB, 'B');
  if (idA === idB) abort('test users A and B resolve to the same account.');
  console.log('Signed in as test users A and B. Running checks against the DEV project.\n');

  try {
    if (!(await cleanup(a, idA, b, idB))) abort('could not remove leftovers from a previous run.');
    await runChecks(a, b, anon, idA, idB);
  } finally {
    await cleanup(a, idA, b, idB);
    await Promise.allSettled([a.auth.signOut(), b.auth.signOut()]);
  }

  console.log(`\n${String(passed)} passed, ${String(failed)} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`${PREFIX}: ${clean(describe(error))}`);
  process.exitCode = 1;
});
