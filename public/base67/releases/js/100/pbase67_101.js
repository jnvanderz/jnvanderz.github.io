/**
 * base67.js
 *
 * Base67 encoder / decoder, following https://github.com/jnvanderz/base67
 *
 * Base67 = 64 data symbols (6 bits each) + 3 signal symbols.
 * This module converts exactly like Base64 (groups of 3 bytes -> 4 symbols,
 * most significant bit first, no padding), using only indexes 0-63.
 * The 3 signal symbols  !  _  ~  (indexes 64-66) are present in the tables
 * but are never produced by encode and never accepted by decode.
 *
 * Usage:
 *   import * as Base67 from "./base67.js";
 *   Base67.encodeText("hola");      // "Q6ziOG"
 *   Base67.decodeText("Q6ziOG");    // "hola"
 */

// ---------------------------------------------------------------------------
// LUT01: index (0-66) -> ASCII code of the symbol.
// Literal copy of the "lut01" file in the repository.
// ---------------------------------------------------------------------------
export const LUT01 = new Uint8Array([
  //  0     1     2     3     4     5     6     7     8     9
  0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, //  0- 9  '0'-'9'
  0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, // 10-19  'A'-'J'
  0x4B, 0x4C, 0x4D, 0x4E, 0x4F, 0x50, 0x51, 0x52, 0x53, 0x54, // 20-29  'K'-'T'
  0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x61, 0x62, 0x63, 0x64, // 30-39  'U'-'Z' 'a'-'d'
  0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, // 40-49  'e'-'n'
  0x6F, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, // 50-59  'o'-'x'
  0x79, 0x7A, 0x2D, 0x2E,                                     // 60-63  'y' 'z' '-' '.'
  0x21, 0x5F, 0x7E,                                           // 64-66  '!' '_' '~'  (signals, unused here)
]);

// ---------------------------------------------------------------------------
// LUT02: ASCII code (0x00-0x7F) -> symbol index. 0xFF = not in the alphabet.
// Literal copy of the "lut02" file in the repository.
// Row = high nibble of the ASCII code, column = low nibble.
// ---------------------------------------------------------------------------
export const LUT02 = new Uint8Array([
  //  x0    x1    x2    x3    x4    x5    x6    x7    x8    x9    xA    xB    xC    xD    xE    xF
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, // 0x  (control)
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, // 1x  (control)
  0xFF, 0x40, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x3E, 0x3F, 0xFF, // 2x  '!'=64  '-'=62  '.'=63
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, // 3x  '0'-'9' = 0-9
  0xFF, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, // 4x  'A'-'O' = 10-24
  0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F, 0x20, 0x21, 0x22, 0x23, 0xFF, 0xFF, 0xFF, 0xFF, 0x41, // 5x  'P'-'Z' = 25-35  '_'=65
  0xFF, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D, 0x2E, 0x2F, 0x30, 0x31, 0x32, // 6x  'a'-'o' = 36-50
  0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0xFF, 0xFF, 0xFF, 0x42, 0xFF, // 7x  'p'-'z' = 51-61  '~'=66
]);

/** Number of symbols that carry data (indexes 0-63). */
const DATA_SYMBOLS = 64;

/**
 * Encodes bytes into Base67 text.
 * @param {Uint8Array|ArrayBuffer|number[]} bytes
 * @returns {string}
 */
export function encode(bytes) {
  const input = toBytes(bytes);
  const out = new Uint8Array(Math.ceil((input.length * 4) / 3));
  let o = 0;
  let i = 0;

  // Full groups: 3 bytes (24 bits) -> 4 symbols of 6 bits.
  for (; i + 2 < input.length; i += 3) {
    const n = (input[i] << 16) | (input[i + 1] << 8) | input[i + 2];
    out[o++] = LUT01[(n >> 18) & 63];
    out[o++] = LUT01[(n >> 12) & 63];
    out[o++] = LUT01[(n >> 6) & 63];
    out[o++] = LUT01[n & 63];
  }

  // Remainder: 1 byte -> 2 symbols, 2 bytes -> 3 symbols (no padding).
  const rest = input.length - i;
  if (rest === 1) {
    const n = input[i] << 16;
    out[o++] = LUT01[(n >> 18) & 63];
    out[o++] = LUT01[(n >> 12) & 63];
  } else if (rest === 2) {
    const n = (input[i] << 16) | (input[i + 1] << 8);
    out[o++] = LUT01[(n >> 18) & 63];
    out[o++] = LUT01[(n >> 12) & 63];
    out[o++] = LUT01[(n >> 6) & 63];
  }

  return asciiToString(out);
}

/**
 * Decodes Base67 text into bytes.
 * Any length is accepted: every symbol contributes 6 bits, every complete
 * group of 8 bits becomes a byte, and leftover bits at the end (fewer than 8)
 * are dropped. The only error is a symbol outside the 64 data symbols
 * (which includes the signals ! _ ~).
 * @param {string} text
 * @returns {Uint8Array}
 */
export function decode(text) {
  if (typeof text !== "string") {
    throw new TypeError("Base67.decode: expected a string");
  }
  const len = text.length;
  const rest = len % 4;

  const out = new Uint8Array(Math.floor((len * 3) / 4));
  let o = 0;
  let i = 0;

  // Full groups: 4 symbols -> 3 bytes.
  for (; i + 3 < len; i += 4) {
    const n =
      (valueAt(text, i) << 18) |
      (valueAt(text, i + 1) << 12) |
      (valueAt(text, i + 2) << 6) |
      valueAt(text, i + 3);
    out[o++] = (n >> 16) & 255;
    out[o++] = (n >> 8) & 255;
    out[o++] = n & 255;
  }

  // Remainder: leftover bits that do not fill a byte are dropped.
  //   1 symbol  ( 6 bits) -> 0 bytes
  //   2 symbols (12 bits) -> 1 byte
  //   3 symbols (18 bits) -> 2 bytes
  if (rest === 1) {
    valueAt(text, i); // still must be a valid data symbol
  } else if (rest === 2) {
    const n = (valueAt(text, i) << 18) | (valueAt(text, i + 1) << 12);
    out[o++] = (n >> 16) & 255;
  } else if (rest === 3) {
    const n =
      (valueAt(text, i) << 18) |
      (valueAt(text, i + 1) << 12) |
      (valueAt(text, i + 2) << 6);
    out[o++] = (n >> 16) & 255;
    out[o++] = (n >> 8) & 255;
  }

  return out;
}

/** Encodes a string (as UTF-8) into Base67. */
export function encodeText(str) {
  return encode(new TextEncoder().encode(str));
}

/** Decodes Base67 into a string (reading the bytes as UTF-8). */
export function decodeText(text) {
  return new TextDecoder("utf-8", { fatal: true }).decode(decode(text));
}

// ---------------------------------------------------------------------------
// Internals (not exported)
// ---------------------------------------------------------------------------

/** 6-bit value of the symbol at text[pos]; throws if it is not a data symbol. */
function valueAt(text, pos) {
  const code = text.charCodeAt(pos);
  const value = code < 128 ? LUT02[code] : 0xFF;
  if (value >= DATA_SYMBOLS) {
    throw new Error(
      "Base67.decode: invalid symbol '" + text[pos] + "' at position " + pos
    );
  }
  return value;
}

function toBytes(x) {
  if (x instanceof Uint8Array) return x;
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  if (Array.isArray(x)) return Uint8Array.from(x);
  throw new TypeError(
    "Base67.encode: expected bytes (Uint8Array, ArrayBuffer or number[]); use encodeText for strings"
  );
}

/** Converts ASCII codes to a string in chunks (avoids the argument-count limit). */
function asciiToString(codes) {
  let s = "";
  for (let i = 0; i < codes.length; i += 8192) {
    s += String.fromCharCode.apply(null, codes.subarray(i, i + 8192));
  }
  return s;
}
