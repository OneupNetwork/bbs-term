import { B2U_PATCH, U2B_PATCH } from "./uao_patch.js";

export const b2uTable = new Uint16Array(65536);
export const u2bTable = new Uint16Array(65536);

let isInitialized = false;
const initListeners = [];

export function addUAOInitListener(listener) {
  if (typeof listener !== "function") return;
  if (isInitialized) {
    listener();
  }
  initListeners.push(listener);
}

function decodeBase64ToUint16(b64) {
  if (typeof Uint8Array.fromBase64 === "function") {
    const bytes = Uint8Array.fromBase64(b64);
    return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  }
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
    const buf = Buffer.from(b64, "base64");
    return new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
  }
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}

export function initBaseBig5Tables(b2u, u2b) {
  // 1. Pre-fill Big5 User-Defined / CP950 Private Use Area (PUA) linear mappings.
  // Browsers (WHATWG Big5-HKSCS) and Node.js (ICU) differ in these extension ranges,
  // whereas UAO 2.50 u2b preserves these exact CP950 PUA mappings (U+E000..U+F848).
  const puaRanges = [
    [0xfa, 0xfe, 0x40, 0xe000],
    [0x8e, 0xa0, 0x40, 0xe311],
    [0x81, 0x8d, 0x40, 0xeeb8],
    [0xc6, 0xc8, 0xa1, 0xf6b1],
  ];
  for (const [hiStart, hiEnd, firstLo, startU] of puaRanges) {
    let u = startU;
    for (let hi = hiStart; hi <= hiEnd; hi++) {
      for (let lo = hi === hiStart ? firstLo : 0x40; lo <= 0xfe; lo++) {
        if (lo > 0x7e && lo < 0xa1) continue;
        const b = (hi << 8) | lo;
        b2u[b] = u;
        u2b[u] = b;
        u++;
      }
    }
  }

  // 2. Scan standard Big5 ranges where WHATWG (browsers) and ICU (Node.js) are 100% identical.
  // Skip extension ranges (0x8140..0xA0FE, 0xA3C0..0xA3FE, 0xC6A1..0xC8FE, 0xF9FE, 0xFA40..0xFEFE)
  // where WHATWG Big5-HKSCS contains duplicate CJK mappings (e.g. 0xFE6F -> 瑜, 0xFBB8 -> 婷, 0xFA66 -> 偽)
  // that would otherwise overwrite standard Big5 entries in u2b.
  const td = new TextDecoder("big5");
  const chunk = new Uint8Array(2);
  for (let hi = 0xa1; hi <= 0xf9; hi++) {
    chunk[0] = hi;
    for (let lo = 0x40; lo <= 0xfe; lo++) {
      if (lo > 0x7e && lo < 0xa1) continue;
      const b = (hi << 8) | lo;
      if (
        (b >= 0xa3c0 && b <= 0xa3fe) ||
        (b >= 0xc6a1 && b <= 0xc8fe) ||
        b === 0xf9fe
      ) {
        continue;
      }
      chunk[1] = lo;
      const s = td.decode(chunk);
      if (s.length === 1 && s !== "\ufffd") {
        const u = s.charCodeAt(0);
        b2u[b] = u;
        u2b[u] = b;
      }
    }
  }
}

export function initUAO() {
  if (isInitialized) {
    return;
  }

  initBaseBig5Tables(b2uTable, u2bTable);

  // Apply UAO 2.50 b2u patch (and invert into u2b)
  const b2uPatchData = decodeBase64ToUint16(B2U_PATCH);
  for (let i = 0; i < b2uPatchData.length; i += 2) {
    const b = b2uPatchData[i];
    const u = b2uPatchData[i + 1];
    b2uTable[b] = u;
    if (u) u2bTable[u] = b;
  }

  // Apply UAO 2.50 u2b alias patch
  const u2bPatchData = decodeBase64ToUint16(U2B_PATCH);
  for (let i = 0; i < u2bPatchData.length; i += 2) {
    const u = u2bPatchData[i];
    const b = u2bPatchData[i + 1];
    u2bTable[u] = b;
  }

  // Setup window.lib backward compatibility
  if (typeof window !== "undefined") {
    window.lib = window.lib || {};
    window.lib.b2uTable = b2uTable;
    window.lib.u2bTable = u2bTable;

    let _b2uArray = null;
    let _u2bArray = null;

    if (!window.lib.b2uArray) {
      Object.defineProperty(window.lib, "b2uArray", {
        configurable: true,
        enumerable: true,
        get() {
          if (!_b2uArray) {
            _b2uArray = new Uint8Array(131072);
            for (let i = 0; i < 65536; i++) {
              const c = b2uTable[i];
              _b2uArray[2 * i] = c >> 8;
              _b2uArray[2 * i + 1] = c & 0xff;
            }
          }
          return _b2uArray;
        }
      });
    }

    if (!window.lib.u2bArray) {
      Object.defineProperty(window.lib, "u2bArray", {
        configurable: true,
        enumerable: true,
        get() {
          if (!_u2bArray) {
            _u2bArray = new Uint8Array(131072);
            for (let i = 0; i < 65536; i++) {
              const c = u2bTable[i] || 0xfffd;
              _u2bArray[2 * i] = c >> 8;
              _u2bArray[2 * i + 1] = c & 0xff;
            }
          }
          return _u2bArray;
        }
      });
    }
  }

  isInitialized = true;
  for (const listener of initListeners) {
    try {
      listener();
    } catch (err) {
      console.error("Error in UAO init listener:", err);
    }
  }
}

// Automatically initialize tables on module load
initUAO();
