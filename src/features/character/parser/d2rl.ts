/**
 * The optional `.d2rl` sidecar D2RLoader writes next to a save. Only the fields a save-age warning needs are read: the
 * format is otherwise undocumented, and an old or odd sidecar must never get in the way of the save itself (callers
 * should catch D2rlParseError and carry on without it).
 *
 * Layout (VERIFIED on 21 files, docs/features/CHARACTER-SAVE.md): magic "D2RL", u16 format, u16 header size 44, u32
 * payload length, the payload's SHA-256, then at 0x34 the save's checksum, size and SHA-256, at 0x74 its last-saved
 * time, at 0x154 length-prefixed strings for the game version, 3 u32s and the mod's folder/name/empty/description/version.
 */
import { D2rlParseError } from './errors.ts';

const MAGIC = 0x4c523244; // D2RL
const HEADER_SIZE = 44;
const D2S_CHECKSUM_OFFSET = 0x34;
const D2S_SIZE_OFFSET = 0x38;
const D2S_SHA256_OFFSET = 0x3c;
const LAST_SAVED_OFFSET = 0x74;
const STRINGS_OFFSET = 0x154;

export interface D2rlFile {
  formatVersion: number;
  /** The game version the save was last written with ("3.3.94995") */
  gameVersion: string;
  /** The ESR version the save was last written with ("3.3.02"); the d2s itself carries no version */
  esrVersion: string;
  /** The save's checksum, as recorded here */
  d2sChecksum: number;
  /** The save's size, as recorded here */
  d2sSize: number;
  /** SHA-256 of the paired .d2s, hex */
  d2sSha256: string;
  /** Last-saved time recorded here (Unix seconds); equals the d2s header's on the verified saves */
  lastSavedAt: number;
}

const hexOf = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

export function parseD2rl(bytes: Uint8Array): D2rlFile {
  if (bytes.length < HEADER_SIZE) throw new D2rlParseError('truncated', 'file ends before its header does', 0);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC) throw new D2rlParseError('bad-magic', 'not a .d2rl sidecar (no "D2RL" magic)', 0);
  const formatVersion = view.getUint16(4, true);
  if (formatVersion !== 2) throw new D2rlParseError('unsupported-version', `format version ${String(formatVersion)} is not 2`, 4);
  const declared = view.getUint32(8, true);
  if (declared !== bytes.length - HEADER_SIZE) {
    throw new D2rlParseError(
      'size-mismatch',
      `payload length ${String(declared)} does not match the file (${String(bytes.length - HEADER_SIZE)})`,
      8
    );
  }

  let offset = STRINGS_OFFSET;
  const readString = (): string => {
    if (offset + 4 > bytes.length) throw new D2rlParseError('truncated', 'string length runs past the end of the file', offset);
    const length = view.getUint32(offset, true);
    if (offset + 4 + length > bytes.length)
      throw new D2rlParseError('invalid-string', `string of ${String(length)} bytes runs past the end of the file`, offset);
    const text = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 4 + length));
    offset += 4 + length;
    return text;
  };
  const gameVersion = readString();
  offset += 12; // u32 ×3
  for (let i = 0; i < 4; i++) readString(); // mod folder, name, empty, description
  const esrVersion = readString();

  return {
    formatVersion,
    gameVersion,
    esrVersion,
    d2sChecksum: view.getUint32(D2S_CHECKSUM_OFFSET, true),
    d2sSize: view.getUint32(D2S_SIZE_OFFSET, true),
    d2sSha256: hexOf(bytes.subarray(D2S_SHA256_OFFSET, D2S_SHA256_OFFSET + 32)),
    lastSavedAt: Number(view.getBigUint64(LAST_SAVED_OFFSET, true)),
  };
}

/** True when the sidecar's recorded SHA-256 is the given save's (WebCrypto). */
export async function d2rlMatchesSave(d2rl: Pick<D2rlFile, 'd2sSha256'>, save: Uint8Array): Promise<boolean> {
  // A copy: WebCrypto wants a BufferSource over an ArrayBuffer, not a possibly shared one
  const digest = await crypto.subtle.digest('SHA-256', save.slice());
  return hexOf(new Uint8Array(digest)) === d2rl.d2sSha256;
}
