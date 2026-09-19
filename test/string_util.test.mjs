import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unescapeStr, wrapText, b2u, u2b, isDBCSLead, ansiHalfColorConv } from '../src/js/string_util.js';
import { Conv, CHARSETS } from '../src/js/conv.js';

test('unescapeStr parses caret notation correctly', () => {
  assert.equal(unescapeStr('^C'), '\x03');
  assert.equal(unescapeStr('^M'), '\r');
  assert.equal(unescapeStr('^['), '\x1b');
  assert.equal(unescapeStr('^?'), '\x7f');
  assert.equal(unescapeStr('\\^'), '^');
  assert.equal(unescapeStr('\\\\'), '\\');
  assert.equal(unescapeStr('plain text'), 'plain text');
});

test('b2u and u2b round-trip standard Big5 characters', () => {
  // 中 = 0xa4a4
  const big5Zhong = '\xa4\xa4';
  const uZhong = b2u(big5Zhong);
  assert.equal(uZhong, '中');
  assert.equal(u2b(uZhong), big5Zhong);

  // 文 = 0xa4e5
  const big5Wen = '\xa4\xe5';
  const uWen = b2u(big5Wen);
  assert.equal(uWen, '文');
  assert.equal(u2b(uWen), big5Wen);
});

test('b2u decodes terminal box-drawing characters and common Big5 symbols correctly', () => {
  const cases = [
    { big5: '\xa2\x77', expected: '─' },
    { big5: '\xa2\x7a', expected: '┌' },
    { big5: '\xa2\x7b', expected: '┐' },
    { big5: '\xa2\x63', expected: '▂' },
    { big5: '\xa1\xca', expected: '﹋' },
    { big5: '\xb1\x7a', expected: '您' },
    { big5: '\xac\x4f', expected: '是' },
    { big5: '\xb2\xc4', expected: '第' },
  ];

  for (const { big5, expected } of cases) {
    assert.equal(b2u(big5), expected, `Failed decoding Big5 0x${big5.charCodeAt(0).toString(16)}${big5.charCodeAt(1).toString(16)}`);
    assert.equal(u2b(expected), big5, `Failed encoding char ${expected}`);
  }
});

test('b2u handles ASCII and mixed strings', () => {
  const mixed = 'Hello \xa4\xa4\xa4\xe5!';
  assert.equal(b2u(mixed), 'Hello 中文!');
  assert.equal(u2b('Hello 中文!'), mixed);
});

test('isDBCSLead identifies Big5 lead bytes', () => {
  assert.equal(isDBCSLead('\x81'), true);
  assert.equal(isDBCSLead('\xa4'), true);
  assert.equal(isDBCSLead('\xfe'), true);
  assert.equal(isDBCSLead('A'), false);
  assert.equal(isDBCSLead('~'), false);
  assert.equal(isDBCSLead('\x80'), false);
});

test('wrapText wraps within max length without breaking words', () => {
  const text = 'This is a long sentence that needs to be wrapped properly across lines.';
  const wrapped = wrapText(text, 20, '\n');
  const lines = wrapped.split('\n');
  assert.ok(lines.length > 1);
  for (const line of lines) {
    assert.ok(line.length <= 25);
  }
});

test('ansiHalfColorConv and Conv.encode handle SGR 66 in UTF-8 and Big5 modes', () => {
  // 中 = \xa4\xa4, 文 = \xa4\xe5
  const pasted = '\x15[31m\x15[66;1;32m中\x15[66;1;33m文';

  // UTF-8 mode: sends SGR 66 directly
  const convUtf8 = new Conv(CHARSETS.UTF8);
  const encodedUtf8 = new TextDecoder().decode(convUtf8.encode(pasted));
  assert.equal(encodedUtf8, pasted);

  // Big5 mode: splits each 2-byte Big5 character in half with \x15[<params>m in between
  const convBig5 = new Conv(CHARSETS.BIG5);
  const encodedBig5 = convBig5.encode(pasted);
  assert.equal(encodedBig5, '\x15[31m\xa4\x15[1;32m\xa4\xa4\x15[1;33m\xe5');
});
