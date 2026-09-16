import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initUAO, b2uTable, u2bTable } from '../src/conv/uao.js';

test('initUAO initializes Big5 tables and applies UAO 2.50 patches', () => {
  initUAO();

  // 1. Standard Big5 character 中 (0xa4a4 -> U+4E2D)
  const bZhong = 0xa4a4;
  assert.equal(b2uTable[bZhong], 0x4e2d);
  assert.equal(u2bTable[0x4e2d], bZhong);

  // 2. Japanese Hiragana and Katakana extensions supported by UAO 2.50
  // あ = U+3042 -> 0xc6e8
  assert.equal(b2uTable[0xc6e8], 0x3042);
  assert.equal(u2bTable[0x3042], 0xc6e8);

  // い = U+3044 -> 0xc6ea
  assert.equal(b2uTable[0xc6ea], 0x3044);
  assert.equal(u2bTable[0x3044], 0xc6ea);

  // ア = U+30a2 -> 0xc77c
  assert.equal(b2uTable[0xc77c], 0x30a2);
  assert.equal(u2bTable[0x30a2], 0xc77c);

  // 3. Special drawing symbols in UAO
  // ★ = U+2605 -> 0xa1b9
  assert.equal(b2uTable[0xa1b9], 0x2605);
  assert.equal(u2bTable[0x2605], 0xa1b9);

  // Repeated call to initUAO is idempotent
  assert.doesNotThrow(() => initUAO());
});

test('initUAO preserves standard Big5 mappings over WHATWG HKSCS duplicates (Issue #45)', () => {
  initUAO();

  // In WHATWG Big5-HKSCS, extension codes like 0xFE6F, 0xFBB8, 0xFA66 also decode
  // to standard CJK characters (瑜, 婷, 偽). Verify u2bTable maps to standard Big5
  // and b2uTable maps the extension codes to their UAO 2.50 characters (坔, 鼦, 牦).
  const cases = [
    ['瑜', 0x745c, 0xb7ec],
    ['坔', 0x5754, 0xfe6f],
    ['婷', 0x5a77, 0xb440],
    ['鼦', 0x9f26, 0xfbb8],
    ['偽', 0x507d, 0xb0b0],
    ['牦', 0x7266, 0xfa66],
    ['晴', 0x6674, 0xb4b8],
    ['煮', 0x716e, 0xb54e],
    ['渝', 0x6e1d, 0xb4fc],
    ['卿', 0x537f, 0xadeb],
    ['杞', 0x675e, 0xa7fb],
  ];

  for (const [ch, u, expectedBig5] of cases) {
    assert.equal(
      u2bTable[u],
      expectedBig5,
      `u2bTable for ${ch} (U+${u.toString(16)}) should be 0x${expectedBig5.toString(16)}`
    );
    assert.equal(
      b2uTable[expectedBig5],
      u,
      `b2uTable for 0x${expectedBig5.toString(16)} should be ${ch} (U+${u.toString(16)})`
    );
  }
});

