import { describe, expect, it } from 'vitest';
import type { Action } from '@reduxjs/toolkit';
import { RequestState } from '@/core/types';
import favoritesReducer, {
  favoritesLoadSucceeded,
  favoritesCleared,
  countsLoadSucceeded,
  toggleFavoriteRequested,
  toggleFavoriteReverted,
  toggleFavoriteSettled,
} from './favoritesSlice';

type FavoritesStateShape = ReturnType<typeof favoritesReducer>;

const reduce = (...actions: readonly Action[]): FavoritesStateShape =>
  actions.reduce<FavoritesStateShape>((state, action) => favoritesReducer(state, action), undefined as unknown as FavoritesStateShape);

describe('favoritesSlice', () => {
  it('starts empty', () => {
    const state = reduce({ type: '@@INIT' });
    expect(state.favoriteItemIds).toEqual([]);
    expect(state.pendingItemIds).toEqual([]);
    expect(state.counts).toEqual({});
  });

  it('loads the signed-in user favourites', () => {
    const state = reduce(favoritesLoadSucceeded(['runeword:Spirit:1', 'htmUnique:Nagelring:rin']));
    expect(state.favoriteItemIds).toEqual(['runeword:Spirit:1', 'htmUnique:Nagelring:rin']);
    expect(state.status).toBe(RequestState.SUCCESS);
  });

  it('clears user favourites on sign-out but keeps public counts', () => {
    const state = reduce(
      favoritesLoadSucceeded(['runeword:Spirit:1']),
      countsLoadSucceeded({ 'runeword:Spirit:1': 4 }),
      favoritesCleared()
    );
    expect(state.favoriteItemIds).toEqual([]);
    expect(state.pendingItemIds).toEqual([]);
    expect(state.counts).toEqual({ 'runeword:Spirit:1': 4 });
  });

  it('optimistically adds a favourite: membership, count +1, pending', () => {
    const state = reduce(countsLoadSucceeded({ 'runeword:Spirit:1': 5 }), toggleFavoriteRequested('runeword:Spirit:1'));
    expect(state.favoriteItemIds).toEqual(['runeword:Spirit:1']);
    expect(state.counts['runeword:Spirit:1']).toBe(6);
    expect(state.pendingItemIds).toEqual(['runeword:Spirit:1']);
  });

  it('optimistically removes a favourite: membership, count -1, pending', () => {
    const state = reduce(
      favoritesLoadSucceeded(['gemword:Black:1']),
      countsLoadSucceeded({ 'gemword:Black:1': 3 }),
      toggleFavoriteRequested('gemword:Black:1')
    );
    expect(state.favoriteItemIds).toEqual([]);
    expect(state.counts['gemword:Black:1']).toBe(2);
    expect(state.pendingItemIds).toEqual(['gemword:Black:1']);
  });

  it('reverts an optimistic toggle back to the pre-request state and clears pending', () => {
    const before = reduce(countsLoadSucceeded({ 'runeword:Spirit:1': 5 }));
    const after = reduce(
      countsLoadSucceeded({ 'runeword:Spirit:1': 5 }),
      toggleFavoriteRequested('runeword:Spirit:1'),
      toggleFavoriteReverted('runeword:Spirit:1')
    );
    expect(after.favoriteItemIds).toEqual(before.favoriteItemIds);
    expect(after.counts).toEqual(before.counts);
    expect(after.pendingItemIds).toEqual([]);
  });

  it('settling a toggle clears only that pending id', () => {
    const state = reduce(
      toggleFavoriteRequested('runeword:Spirit:1'),
      toggleFavoriteRequested('gemword:Black:1'),
      toggleFavoriteSettled('runeword:Spirit:1')
    );
    expect(state.pendingItemIds).toEqual(['gemword:Black:1']);
  });

  it('keeps the counts map sparse: a fresh favourite creates an entry, removing the last drops it', () => {
    // Favouriting an item with no existing count entry creates one at 1.
    const added = reduce(toggleFavoriteRequested('htmUnique:Nagelring:rin'));
    expect(added.counts).toEqual({ 'htmUnique:Nagelring:rin': 1 });

    // Unfavouriting the last (and only) favouriter drops the entry rather than storing 0.
    const removed = reduce(
      favoritesLoadSucceeded(['htmUnique:Nagelring:rin']),
      countsLoadSucceeded({ 'htmUnique:Nagelring:rin': 1 }),
      toggleFavoriteRequested('htmUnique:Nagelring:rin')
    );
    expect(removed.counts).toEqual({});
  });
});
