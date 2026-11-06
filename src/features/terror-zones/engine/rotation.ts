/*
 * The offline terror zone rotation of D2R (and so of Eastern Sun Resurrected, played offline), worked out from
 * desecratedzones.json. Each slot's roll is a SHA-1 of the slot's start time XOR the seed; the pick is weighted: the
 * zone picked last cannot repeat and a zone gets likelier while it waits, so every slot depends on all the slots
 * before it and the rotation is replayed from the config's start (cached here, so it is replayed once per page).
 *
 * Ported to TypeScript from two MIT-licensed sources:
 * - d2r-arcane-tracker (https://github.com/hyperremix/d2r-arcane-tracker), electron/services/terrorZoneSchedule.ts,
 *   where the rotation was recovered from the game (docs/TERROR_ZONE_FINDINGS_2026.md there);
 * - ESR Docs (https://github.com/dotsyzygy/esr-docs), site/assets/terror-zones.js, a browser port with a synchronous
 *   SHA-1, itself ported from d2r-arcane-tracker.
 *
 * MIT License
 *
 * Copyright (c) 2025 Fredrik Pettersson
 * Copyright (c) 2026 Syzygy (dotsyzygy)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { sha1 } from './sha1';

const TWO_POW_32 = 2 ** 32;

/** A random fraction in [0, 1) for a time: the first 4 digest bytes (little endian) of SHA-1(uint64_le(time XOR seed)). */
export function roll(timeSeconds: number, seed: bigint): number {
  const input = new Uint8Array(8);
  new DataView(input.buffer).setBigUint64(0, BigInt.asUintN(64, BigInt(timeSeconds) ^ seed), true);
  const digest = sha1(input);
  return new DataView(digest.buffer).getUint32(0, true) / TWO_POW_32;
}

export interface RotationParams {
  /** Unix seconds of slot 0 */
  readonly start: number;
  /** Seconds from one slot's start to the next (zone + break minutes) */
  readonly period: number;
  readonly seed: bigint;
  readonly zoneCount: number;
}

/**
 * The zone index picked in each slot, computed on demand and cached: asking for slot n replays the slots not computed
 * yet up to n, never from the start again. One instance per config.
 */
export class Rotation {
  readonly params: RotationParams;
  readonly #weights: number[];
  readonly #picks: number[] = [];

  constructor(params: RotationParams) {
    if (params.zoneCount < 2) throw new RangeError('A terror zone rotation needs at least 2 zones');
    if (params.period <= 0) throw new RangeError('A terror zone slot needs a positive length');
    this.params = params;
    const { start, period, seed, zoneCount } = params;
    this.#weights = new Array<number>(zoneCount).fill(1 / (zoneCount - 1));
    // The game starts as if a zone had been picked in the slot before the first one
    this.#weights[Math.floor(roll(start - period, seed) * zoneCount)] = 0;
  }

  /** How many slots are cached (slots 0 … computed - 1) */
  get computed(): number {
    return this.#picks.length;
  }

  /** The zone index of slot `slot` (≥ 0) */
  pick(slot: number): number {
    if (!Number.isInteger(slot) || slot < 0) throw new RangeError(`No terror zone slot ${String(slot)}`);
    while (this.#picks.length <= slot) this.#next();
    return this.#picks[slot] ?? 0;
  }

  /** The zone indices of slots `from` … `from + count - 1` */
  picks(from: number, count: number): number[] {
    return Array.from({ length: count }, (_, i) => this.pick(from + i));
  }

  #next(): void {
    const { start, period, seed, zoneCount } = this.params;
    const weights = this.#weights;
    const slotRoll = roll(start + period * this.#picks.length, seed);
    // Rounding can leave the cumulative weight just below 1: the last zone is picked then
    let pick = zoneCount - 1;
    let share = 0;
    let cumulative = 0;
    for (let index = 0; index < zoneCount; index++) {
      const weight = weights[index] ?? 0;
      cumulative += weight;
      if (slotRoll < cumulative) {
        pick = index;
        share = weight / (zoneCount - 1);
        break;
      }
    }
    for (let index = 0; index < zoneCount; index++) weights[index] = (weights[index] ?? 0) + share;
    weights[pick] = 0;
    this.#picks.push(pick);
  }
}
