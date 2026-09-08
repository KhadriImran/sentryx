/* ==========================================================================
   SENTRYX — keccak256 (Keccak-f[1600], rate 1088, pad 0x01)
   ---------------------------------------------------------------------------
   This is Ethereum's keccak256 — NOT NIST SHA3-256 (different padding byte).
   Hand-written, ~4KB, no dependency. Needed for EIP-55 address checksums and
   4-byte function selectors.

   Exposes:
     SENTRYX_keccak.hex(uint8array)  -> "0x…" 32-byte digest
     SENTRYX_keccak.utf8(string)     -> "0x…" digest of the UTF-8 bytes
     SENTRYX_keccak.selector(sig)    -> "0x…" first 4 bytes of keccak(sig)
     SENTRYX_keccak.toChecksum(addr) -> EIP-55 mixed-case address
     SENTRYX_keccak.isChecksumValid(addr) -> bool

   Verified against:
     keccak256("")    = c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
     keccak256("abc") = 4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45
     selector("transfer(address,uint256)") = 0xa9059cbb
   ========================================================================== */
(function (global) {
  "use strict";

  // Round constants, split into low/high 32-bit halves (JS has no 64-bit ints).
  var RC = [
    [0x00000001, 0x00000000], [0x00008082, 0x00000000], [0x0000808a, 0x80000000],
    [0x80008000, 0x80000000], [0x0000808b, 0x00000000], [0x80000001, 0x00000000],
    [0x80008081, 0x80000000], [0x00008009, 0x80000000], [0x0000008a, 0x00000000],
    [0x00000088, 0x00000000], [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
    [0x8000808b, 0x00000000], [0x0000008b, 0x80000000], [0x00008089, 0x80000000],
    [0x00008003, 0x80000000], [0x00008002, 0x80000000], [0x00000080, 0x80000000],
    [0x0000800a, 0x00000000], [0x8000000a, 0x80000000], [0x80008081, 0x80000000],
    [0x00008080, 0x80000000], [0x80000001, 0x00000000], [0x80008008, 0x80000000]
  ];
  function keccakF(s) {
    // s: Int32Array(50) — 25 lanes as [lo, hi] pairs.
    var C = new Int32Array(10), D = new Int32Array(10);
    var x, y, r, lo, hi, idx;

    for (r = 0; r < 24; r++) {
      // theta
      for (x = 0; x < 5; x++) {
        C[x * 2] = s[x * 2] ^ s[(x + 5) * 2] ^ s[(x + 10) * 2] ^ s[(x + 15) * 2] ^ s[(x + 20) * 2];
        C[x * 2 + 1] = s[x * 2 + 1] ^ s[(x + 5) * 2 + 1] ^ s[(x + 10) * 2 + 1] ^ s[(x + 15) * 2 + 1] ^ s[(x + 20) * 2 + 1];
      }
      for (x = 0; x < 5; x++) {
        var xp = ((x + 1) % 5) * 2, xm = ((x + 4) % 5) * 2;
        // D[x] = C[x-1] ^ rotl(C[x+1], 1)
        D[x * 2] = C[xm] ^ (((C[xp] << 1) | (C[xp + 1] >>> 31)) | 0);
        D[x * 2 + 1] = C[xm + 1] ^ (((C[xp + 1] << 1) | (C[xp] >>> 31)) | 0);
      }
      for (x = 0; x < 5; x++) {
        for (y = 0; y < 5; y++) {
          idx = (x + 5 * y) * 2;
          s[idx] ^= D[x * 2];
          s[idx + 1] ^= D[x * 2 + 1];
        }
      }

      // rho + pi
      var B = new Int32Array(50);
      for (x = 0; x < 5; x++) {
        for (y = 0; y < 5; y++) {
          idx = (x + 5 * y) * 2;
          lo = s[idx]; hi = s[idx + 1];
          var n = ROTATION[x + 5 * y];
          if (n === 0) { var nlo = lo, nhi = hi; }
          else if (n < 32) {
            nlo = ((lo << n) | (hi >>> (32 - n))) | 0;
            nhi = ((hi << n) | (lo >>> (32 - n))) | 0;
          } else if (n === 32) { nlo = hi; nhi = lo; }
          else {
            var m = n - 32;
            nlo = ((hi << m) | (lo >>> (32 - m))) | 0;
            nhi = ((lo << m) | (hi >>> (32 - m))) | 0;
          }
          // pi: B[y][2x+3y] = rotated A[x][y]
          var nx = y, ny = (2 * x + 3 * y) % 5;
          var bidx = (nx + 5 * ny) * 2;
          B[bidx] = nlo; B[bidx + 1] = nhi;
        }
      }

      // chi
      for (y = 0; y < 5; y++) {
        for (x = 0; x < 5; x++) {
          idx = (x + 5 * y) * 2;
          var i1 = (((x + 1) % 5) + 5 * y) * 2, i2 = (((x + 2) % 5) + 5 * y) * 2;
          s[idx] = B[idx] ^ ((~B[i1]) & B[i2]);
          s[idx + 1] = B[idx + 1] ^ ((~B[i1 + 1]) & B[i2 + 1]);
        }
      }

      // iota
      s[0] ^= RC[r][0];
      s[1] ^= RC[r][1];
    }
    return s;
  }

  // Rotation offsets indexed by lane (x + 5y), standard Keccak table.
  var ROTATION = [
     0,  1, 62, 28, 27,
    36, 44,  6, 55, 20,
     3, 10, 43, 25, 39,
    41, 45, 15, 21,  8,
    18,  2, 61, 56, 14
  ];

  var RATE = 136; // 1088 bits for keccak256

  function keccak256(bytes) {
    var s = new Int32Array(50);
    var blocks = Math.floor(bytes.length / RATE);
    var i, j, off;

    for (i = 0; i < blocks; i++) {
      off = i * RATE;
      for (j = 0; j < RATE; j++) {
        var lane = (j / 8) | 0, byteInLane = j % 8;
        var half = byteInLane < 4 ? 0 : 1;
        var shift = (byteInLane % 4) * 8;
        s[lane * 2 + half] ^= (bytes[off + j] << shift);
      }
      keccakF(s);
    }

    // final block with pad10*1 (0x01 … 0x80)
    var rem = bytes.length - blocks * RATE;
    var last = new Uint8Array(RATE);
    for (j = 0; j < rem; j++) last[j] = bytes[blocks * RATE + j];
    last[rem] = 0x01;
    last[RATE - 1] |= 0x80;
    for (j = 0; j < RATE; j++) {
      var lane2 = (j / 8) | 0, bil = j % 8;
      var half2 = bil < 4 ? 0 : 1;
      var sh2 = (bil % 4) * 8;
      s[lane2 * 2 + half2] ^= (last[j] << sh2);
    }
    keccakF(s);

    // squeeze 32 bytes
    var out = new Uint8Array(32);
    for (j = 0; j < 32; j++) {
      var lane3 = (j / 8) | 0, bil3 = j % 8;
      var half3 = bil3 < 4 ? 0 : 1;
      var sh3 = (bil3 % 4) * 8;
      out[j] = (s[lane3 * 2 + half3] >>> sh3) & 0xff;
    }
    return out;
  }

  function toHex(u8) {
    var h = "0x";
    for (var i = 0; i < u8.length; i++) h += (u8[i] < 16 ? "0" : "") + u8[i].toString(16);
    return h;
  }
  function utf8Bytes(str) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }

  var API = {
    hex: function (bytes) { return toHex(keccak256(bytes)); },
    utf8: function (str) { return toHex(keccak256(utf8Bytes(str))); },
    selector: function (sig) { return API.utf8(sig.replace(/\s+/g, "")).slice(0, 10); },
    toChecksum: function (addr) {
      var a = String(addr).toLowerCase().replace(/^0x/, "");
      if (!/^[0-9a-f]{40}$/.test(a)) return null;
      var h = API.utf8(a).slice(2);
      var out = "0x";
      for (var i = 0; i < 40; i++) {
        out += parseInt(h[i], 16) >= 8 ? a[i].toUpperCase() : a[i];
      }
      return out;
    },
    isChecksumValid: function (addr) {
      var a = String(addr).replace(/^0x/, "");
      if (!/^[0-9a-fA-F]{40}$/.test(a)) return false;
      if (a === a.toLowerCase() || a === a.toUpperCase()) return null; // no checksum present
      return API.toChecksum(a) === "0x" + a;
    },
    _selfTest: function () {
      return {
        empty: API.utf8("") === "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
        abc: API.utf8("abc") === "0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45",
        transfer: API.selector("transfer(address,uint256)") === "0xa9059cbb"
      };
    }
  };
  global.SENTRYX_keccak = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
