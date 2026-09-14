import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CanvasRenderer } from '../src/components/Canvas/CanvasRenderer.js';
import { SmoothAnsiArt } from '../src/components/Canvas/SmoothAnsiArt.js';

class MockChar {
  constructor(ch = ' ', fg = 7, bg = 0) {
    this.ch = ch;
    this.fg = fg;
    this.bg = bg;
    this.isDBCSLead = false;
    this.isDBCSTrail = false;
    this.blink = false;
    this.underLine = false;
  }
  getFg() {
    return this.fg;
  }
  getBg() {
    return this.bg;
  }
  isPartOfURL() {
    return false;
  }
}

function parseAnsiGrid(ansiLines, cols = 80) {
  const rows = ansiLines.length;
  const lines = [];
  for (let r = 0; r < rows; r++) {
    const row = Array.from({ length: cols }, () => new MockChar(' '));
    let fg = 7;
    let bg = 0;
    let bold = false;
    let c = 0;
    const str = ansiLines[r];
    for (let i = 0; i < str.length && c < cols; i++) {
      if (str[i] === '\x1b') {
        const m = str.slice(i).match(/^\x1b\[([0-9;]*)m/);
        if (m) {
          const parts =
            m[1] === ''
              ? [0]
              : m[1].split(';').map((x) => (x === '' ? 0 : parseInt(x, 10)));
          for (const p of parts) {
            if (p === 0) {
              fg = 7;
              bg = 0;
              bold = false;
            } else if (p === 1) {
              bold = true;
            } else if (p >= 30 && p <= 37) {
              fg = p - 30;
            } else if (p >= 40 && p <= 47) {
              bg = p - 40;
            }
          }
          i += m[0].length - 1;
          continue;
        }
      }
      const ch = str[i];
      const isWide = ch.charCodeAt(0) > 127;
      const realFg = bold && fg < 8 ? fg + 8 : fg;
      row[c].ch = ch;
      row[c].fg = realFg;
      row[c].bg = bg;
      if (isWide) {
        row[c].isDBCSLead = true;
        if (c + 1 < cols) {
          row[c + 1].ch = '';
          row[c + 1].isDBCSTrail = true;
          row[c + 1].fg = realFg;
          row[c + 1].bg = bg;
        }
        c += 2;
      } else {
        c += 1;
      }
    }
    lines.push(row);
  }
  return lines;
}

function renderToPaths(lines, cols = 80, rows = lines.length) {
  const renderer = new CanvasRenderer();
  const paths = [];
  const rects = [];
  let curPath = [];
  const mockCtx = {
    fillStyle: '',
    setTransform() {},
    save() {},
    restore() {},
    beginPath() {
      curPath = [];
    },
    closePath() {
      paths.push({ fillStyle: this.fillStyle, points: [...curPath] });
      curPath = [];
    },
    moveTo(x, y) {
      curPath.push({ op: 'M', x, y });
    },
    lineTo(x, y) {
      curPath.push({ op: 'L', x, y });
    },
    rect(x, y, w, h) {
      rects.push({ fillStyle: this.fillStyle, x, y, w, h });
    },
    fill() {},
    fillRect() {},
    fillText() {},
    measureText() {
      return { width: 10 };
    },
  };

  renderer.drawContent(mockCtx, cols, rows, 1, 1, cols, rows, 1, true, null, {
    lines,
    smoothAnsiArt: true,
  });

  return { paths, rects, blockGrid: renderer.blockGrid };
}

test('CanvasRenderer registers solid bgIndex === 0 cells in blockGrid when smoothAnsiArt is enabled', () => {
  const lines = parseAnsiGrid(['\x1b[30;47m▋\x1b[m  ']);
  const { blockGrid } = renderToPaths(lines, 10, 1);

  assert.ok(blockGrid[0], 'col 0 should be registered');
  assert.equal(blockGrid[0].type, '▋');
  assert.equal(blockGrid[0].fgIndex, 0);
  assert.equal(blockGrid[0].bgIndex, 7);

  // Col 2 is space with bgIndex === 0
  assert.ok(
    blockGrid[2],
    'col 2 (bgIndex === 0 space) must be registered in blockGrid'
  );
  assert.equal(blockGrid[2].type, '█');
  assert.equal(blockGrid[2].fgIndex, 0);
  assert.equal(blockGrid[2].bgIndex, 0);
});

test('SmoothAnsiArt smooths inverted fractional blocks and multi-column diagonal steps continuously without staircases', () => {
  const ansiLines = [
    '\x1b[30;47m▋\x1b[37m    \x1b[40m█▆         \x1b[30;47m▎\x1b[37m    \x1b[40m▍',
    '\x1b[33m  \x1b[37m█\x1b[47m      \x1b[40m▋     \x1b[30;47m▊\x1b[37;40m█\x1b[47m    \x1b[40m▍     \x1b[33m燈  光 (美工)  \x1b[1;32mFrankWW\x1b[m',
    '  \x1b[30;47m▍\x1b[37;40m█\x1b[47m \x1b[33m▊ \x1b[37;40m█▏   \x1b[30;47m▌\x1b[33m  ▊  \x1b[37;40m▎     \x1b[30m劇  務 (法務)\x1b[37m',
    '\x1b[1;32m    \x1b[;30;47m▏\x1b[33m  █  \x1b[37;40m▊   \x1b[30;47m▎\x1b[37;43m▍\x1b[33;47m▍\x1b[37;40m█',
    '      █\x1b[47m \x1b[33m█ \x1b[37;40m█   \x1b[30;47m▏\x1b[33m█  \x1b[37;40m▊       \x1b[33m錄  音 (活動新聞)  \x1b[1;32ms5048218\x1b[;32m[實習]\x1b[37m',
    '        █\x1b[33;47m▋\x1b[37;40m█▅█\x1b[47m    \x1b[40m█▆▂    \x1b[33m客  串 (特別來賓)  \x1b[1;32mtestread  \x1b[m',
  ];

  const lines = parseAnsiGrid(ansiLines, 80);
  const { paths } = renderToPaths(lines, 80, 6);

  // Verify Row 0 Col 0..1 (▋ fg=0 bg=7): slopes from x=0.5 (y=0) to x=2.0 (y=1)
  const row0Left = paths.find(
    (p) => p.points[0].x === 0 && p.points[0].y === 0
  );
  assert.ok(row0Left, 'Row 0 Col 0..1 path should exist');
  assert.deepEqual(
    row0Left.points.map((pt) => [pt.x, pt.y]),
    [
      [0, 0],
      [0.5, 0],
      [2, 1],
      [0, 1],
    ]
  );

  // Verify Row 1 Col 2..3 (█ fg=7 bg=0): slopes left edge from x=2.0 (y=1) to x=2.375 (y=2)
  const row1Left = paths.find(
    (p) => p.points[0].x === 2 && p.points[0].y === 1
  );
  assert.ok(row1Left, 'Row 1 Col 2..3 path should exist');
  assert.equal(row1Left.points[0].x, 2);
  assert.equal(row1Left.points[0].y, 1);
  assert.equal(row1Left.points[3].x, 2.375);
  assert.equal(row1Left.points[3].y, 2);

  // Verify Row 2 Col 2..3 (▍ fg=0 bg=7): slopes from x=2.375 (y=2) to x=4.0 (y=3)
  const row2Left = paths.find(
    (p) => p.points[0].x === 2 && p.points[0].y === 2
  );
  assert.ok(row2Left, 'Row 2 Col 2..3 path should exist');
  assert.deepEqual(
    row2Left.points.map((pt) => [pt.x, pt.y]),
    [
      [2, 2],
      [2.375, 2],
      [4, 3],
      [2, 3],
    ]
  );

  // Verify Row 3 Col 4..5 (▏ fg=0 bg=7): slopes from x=4.0 (y=3) to x=6.0 (y=4)
  const row3Left = paths.find(
    (p) => p.points[0].x === 4 && p.points[0].y === 3
  );
  assert.ok(row3Left, 'Row 3 Col 4..5 path should exist');
  assert.deepEqual(
    row3Left.points.map((pt) => [pt.x, pt.y]),
    [
      [4, 3],
      [4, 3],
      [6, 4],
      [4, 4],
    ]
  );

  // Verify Row 4 Col 6..7 (█ fg=7 bg=0): diagonal step from x=6.0 (y=4) to x=8.0 (y=5)
  const row4Left = paths.find(
    (p) => p.points[0].x === 6 && p.points[0].y === 4
  );
  assert.ok(row4Left, 'Row 4 Col 6..7 diagonal step path should exist');
  assert.equal(row4Left.points[0].x, 6);
  assert.equal(row4Left.points[0].y, 4);
  assert.equal(row4Left.points[row4Left.points.length - 1].x, 8);
  assert.equal(row4Left.points[row4Left.points.length - 1].y, 5);

  // Verify Row 5 Col 8..9 (█ fg=7 bg=0): diagonal step from x=8.0 (y=5) to x=10.0 (y=6)
  const row5Left = paths.find(
    (p) => p.points[0].x === 8 && p.points[0].y === 5
  );
  assert.ok(row5Left, 'Row 5 Col 8..9 diagonal step path should exist');
  assert.equal(row5Left.points[0].x, 8);
  assert.equal(row5Left.points[0].y, 5);
  assert.equal(row5Left.points[row5Left.points.length - 1].x, 10);
  assert.equal(row5Left.points[row5Left.points.length - 1].y, 6);
});

test('SmoothAnsiArt does not falsely convert 90-degree corners of rectangular boxes into diagonal triangles', () => {
  const boxLines = ['  ██████  ', '  █    █  ', '  ██████  '];
  const lines = parseAnsiGrid(boxLines, 10);
  const { paths, rects } = renderToPaths(lines, 10, 3);

  // All full blocks in a rectangular box should be drawn as rectangles, not diagonal triangles
  assert.equal(paths.length, 0, 'Rectangular box should have 0 sloped paths');
  assert.ok(
    rects.length > 0,
    'Rectangular box blocks should be drawn as rects'
  );
});

test('CanvasRenderer snaps background runs and ANSI blocks to exact integer device pixels under non-integer scaleX/scaleY without gaps or overlaps', () => {
  const renderer = new CanvasRenderer();
  const fillRects = [];
  const blockRects = [];
  const fillTexts = [];

  const mockCtx = {
    fillStyle: '',
    setTransform() {},
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    clip() {},
    rect(x, y, w, h) {
      blockRects.push({ fillStyle: this.fillStyle, x, y, w, h });
    },
    fill() {},
    fillRect(x, y, w, h) {
      fillRects.push({ fillStyle: this.fillStyle, x, y, w, h });
    },
    fillText(text, x, y) {
      fillTexts.push({ text, x, y });
    },
    measureText() {
      return { width: 10 };
    },
  };

  // Create 2 rows x 4 cols with non-integer scaling (chw=9, chh=17, scaleX=1.27, scaleY=1.13, dpr=1.25)
  const lines = parseAnsiGrid(
    ['\x1b[31;44m▀\x1b[32;44m▄', '\x1b[33;41m█\x1b[34;42m█'],
    4
  );

  const chw = 9;
  const chh = 17;
  const effScaleX = 1.27 * 1.25;
  const effScaleY = 1.13 * 1.25;

  renderer.drawContent(
    mockCtx,
    4,
    2,
    chw,
    chh,
    4 * chw,
    2 * chh,
    1.25,
    true,
    null,
    {
      lines,
      smoothAnsiArt: true,
      effScaleX,
      effScaleY,
    }
  );

  // Every background fillRect and block rect coordinate must be an exact integer
  for (const r of fillRects) {
    assert.equal(r.x, Math.round(r.x), `fillRect x (${r.x}) must be integer`);
    assert.equal(r.y, Math.round(r.y), `fillRect y (${r.y}) must be integer`);
    assert.equal(r.w, Math.round(r.w), `fillRect w (${r.w}) must be integer`);
    assert.equal(r.h, Math.round(r.h), `fillRect h (${r.h}) must be integer`);
  }
  for (const r of blockRects) {
    assert.equal(r.x, Math.round(r.x), `block rect x (${r.x}) must be integer`);
    assert.equal(r.y, Math.round(r.y), `block rect y (${r.y}) must be integer`);
    assert.equal(r.w, Math.round(r.w), `block rect w (${r.w}) must be integer`);
    assert.equal(r.h, Math.round(r.h), `block rect h (${r.h}) must be integer`);
  }

  // Verify upper half block ▀ and lower half block ▄ in row 0 share the exact same integer split Y
  const row0Y0 = Math.round(0 * chh * effScaleY);
  const row0Y1 = Math.round(1 * chh * effScaleY);
  const row0H = row0Y1 - row0Y0;
  const expectedMidY = row0Y0 + Math.round(0.5 * row0H);

  const upperBlock = blockRects.find(
    (r) => r.y === row0Y0 && r.h === expectedMidY - row0Y0
  );
  const lowerBlock = blockRects.find(
    (r) => r.y === expectedMidY && r.h === row0Y1 - expectedMidY
  );
  assert.ok(upperBlock, 'Upper half block ▀ should end at exact integer midY');
  assert.ok(
    lowerBlock,
    'Lower half block ▄ should start at exact integer midY'
  );
  assert.equal(
    upperBlock.y + upperBlock.h,
    lowerBlock.y,
    '▀ and ▄ must meet with zero gap and zero overlap'
  );
  assert.equal(
    fillTexts.length,
    0,
    'No ANSI block character should fall back to fillText'
  );
});

test('Dual-color DBCS block characters render as geometric blocks without falling back to fillText', () => {
  const renderer = new CanvasRenderer();
  const blockRects = [];
  const clipRects = [];
  const fillTexts = [];

  const mockCtx = {
    fillStyle: '',
    setTransform() {},
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    clip() {},
    rect(x, y, w, h) {
      blockRects.push({ x, y, w, h });
    },
    fill() {},
    fillRect() {},
    fillText(text) {
      fillTexts.push(text);
    },
    measureText() {
      return { width: 10 };
    },
  };

  // Create a 2-column DBCS full block █ with lead fg=1 (Red) and trail fg=4 (Blue)
  const row = [new MockChar('█', 1, 0), new MockChar('', 4, 0)];
  row[0].isDBCSLead = true;
  row[1].isDBCSTrail = true;

  renderer.drawContent(mockCtx, 2, 1, 10, 20, 20, 20, 1, true, null, {
    lines: [row],
    smoothAnsiArt: true,
    effScaleX: 1.3,
    effScaleY: 1.3,
  });

  assert.equal(
    fillTexts.length,
    0,
    'Dual-color DBCS block █ must NOT be drawn via fillText font glyph'
  );
  assert.equal(
    blockRects.length,
    2,
    'Dual-color DBCS block █ must be split into two integer-aligned geometric block rects'
  );
  assert.equal(
    blockRects[0].x + blockRects[0].w,
    blockRects[1].x,
    'Left half and right half of dual-color block must share exact integer boundary'
  );
});
