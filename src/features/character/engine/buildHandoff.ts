/**
 * "Create a build from this character": the My Character page opens `/builds/new` with the stored save in the router
 * state, and the create page starts its "Start from a save file" flow with it, as if the file had been picked. Router
 * state (history.state) structured-clones the bytes, never leaves the browser, and is dropped by a redirect (signed out:
 * `/builds/new` sends to `/builds`), so a handoff cannot surface later on another visit. `/builds/new` without it works
 * as before.
 */

export interface CharacterSaveHandoff {
  /** The raw .d2s */
  readonly bytes: Uint8Array;
  /** The uploaded file name ("SpinToWin.d2s"), shown as the draft's source */
  readonly fileName: string;
  /** The ESR version of the save's verified .d2rl; null without one */
  readonly sidecarVersion: string | null;
}

const STATE_KEY = 'characterSave';

/** The router state of the navigation to `/builds/new` */
export function saveHandoffState(handoff: CharacterSaveHandoff): Readonly<Record<string, CharacterSaveHandoff>> {
  return { [STATE_KEY]: handoff };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The handoff in a location's state, or null (no state, another page's state, or a malformed one). */
export function readSaveHandoff(state: unknown): CharacterSaveHandoff | null {
  if (!isRecord(state)) return null;
  const handoff = state[STATE_KEY];
  if (!isRecord(handoff)) return null;
  const { bytes, fileName, sidecarVersion } = handoff;
  // By tag, not instanceof: a cloned state can come from another realm (a test environment)
  if (!ArrayBuffer.isView(bytes) || Object.prototype.toString.call(bytes) !== '[object Uint8Array]' || typeof fileName !== 'string') {
    return null;
  }
  if (sidecarVersion !== null && typeof sidecarVersion !== 'string') return null;
  return { bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), fileName, sidecarVersion };
}
