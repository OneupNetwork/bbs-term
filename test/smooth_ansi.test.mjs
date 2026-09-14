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

test('CanvasRenderer snaps text draw coordinates and glyph em-box top to exact integer device pixels when lineHeight > 1.0 produces odd cell heights', () => {
  const renderer = new CanvasRenderer();
  const textCalls = [];
  let appliedFont = '';
  let currentTransform = [1, 0, 0, 1, 0, 0];

  const mockCtx = {
    fillStyle: '',
    get font() {
      return appliedFont;
    },
    set font(val) {
      appliedFont = val;
    },
    setTransform(a, b, c, d, e, f) {
      currentTransform = [a, b, c, d, e, f];
    },
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    clip() {},
    rect() {},
    fill() {},
    fillRect() {},
    fillText(text, x, y) {
      // Compute actual device pixel draw coordinate taking transform into account
      const devX = currentTransform[0] * x + currentTransform[4];
      const devY = currentTransform[3] * y + currentTransform[5];
      textCalls.push({
        text,
        devX,
        devY,
        scaleY: currentTransform[3],
        font: appliedFont,
      });
    },
    measureText(str) {
      return { width: str.length === 1 && str.charCodeAt(0) > 127 ? 24 : 12 };
    },
  };

  const row0 = [
    new MockChar('測試', 7, 0),
    new MockChar('', 7, 0),
    new MockChar('A', 7, 0),
  ];
  row0[0].isDBCSLead = true;
  row0[1].isDBCSTrail = true;
  const row1 = [
    new MockChar('行高', 7, 0),
    new MockChar('', 7, 0),
    new MockChar('B', 7, 0),
  ];
  row1[0].isDBCSLead = true;
  row1[1].isDBCSTrail = true;

  // Case: fontSize = 24, lineHeight = 1.2 => chh = 29 (ODD cell height!)
  renderer.drawContent(mockCtx, 3, 2, 12, 29, 36, 58, 1, true, null, {
    lines: [row0, row1],
    fontSize: 24,
    effScaleX: 1,
    effScaleY: 1,
  });

  assert.equal(textCalls.length, 4);
  for (const call of textCalls) {
    assert.equal(
      call.font,
      '24px MingLiu, monospace',
      'Device font size should be an even integer'
    );
    assert.equal(
      call.scaleY,
      1,
      'Vertical transform scale must be 1 to prevent stretching bitmap font strikes'
    );
    assert.equal(
      call.devY % 1,
      0,
      `Vertical draw coordinate devY (${call.devY}) must be an exact integer, never .5`
    );
    const glyphTop = call.devY - 24 / 2;
    assert.equal(
      glyphTop % 1,
      0,
      `Glyph em-box top (${glyphTop}) must land on an exact integer device pixel`
    );
  }
});

test('Multi-column DBCS fractional block ramps resolve boundary coordinates across all covered columns (hoody WANTED W and A)', () => {
  const cols = 15;
  const rows = 3;
  const grid = new Array(rows * cols).fill(null);

  // Set up Row 0 (top neighbors):
  // W left (col 2..3): col 2 is yellow solid (3), col 3 is black solid (0) -> boundary at col 3 (topW = 0.5)
  grid[0 * cols + 2] = { type: '█', fgIndex: 3, bgIndex: 3, span: 1, r: 0, c: 2, isSolid: true };
  grid[0 * cols + 3] = { type: '█', fgIndex: 0, bgIndex: 0, span: 1, r: 0, c: 3, isSolid: true };
  // W right (col 7..8): col 7 is ◢ (bottom black 0), col 8 is black solid (0) -> topW = 1.0 across [7, 9)
  grid[0 * cols + 7] = { type: '◢', fgIndex: 0, bgIndex: 3, span: 2, r: 0, c: 7 };
  grid[0 * cols + 8] = grid[0 * cols + 7];
  // A right (col 11..12): col 11 is black solid (0), col 12 is yellow solid (3) -> boundary at col 12 (topW = 0.5)
  grid[0 * cols + 11] = { type: '█', fgIndex: 0, bgIndex: 0, span: 1, r: 0, c: 11, isSolid: true };
  grid[0 * cols + 12] = { type: '█', fgIndex: 3, bgIndex: 3, span: 1, r: 0, c: 12, isSolid: true };

  // Set up Row 1 (fractional DBCS blocks in middle row):
  // W left: ▊ fg=3 bg=0 at col 2..3
  grid[1 * cols + 2] = { type: '▊', fgIndex: 3, bgIndex: 0, span: 2, r: 1, c: 2 };
  grid[1 * cols + 3] = grid[1 * cols + 2];
  // W right: ▊ fg=0 bg=3 at col 7..8
  grid[1 * cols + 7] = { type: '▊', fgIndex: 0, bgIndex: 3, span: 2, r: 1, c: 7 };
  grid[1 * cols + 8] = grid[1 * cols + 7];
  // A right: ▊ fg=0 bg=3 at col 11..12
  grid[1 * cols + 11] = { type: '▊', fgIndex: 0, bgIndex: 3, span: 2, r: 1, c: 11 };
  grid[1 * cols + 12] = grid[1 * cols + 11];

  // Set up Row 2 (bottom neighbors):
  // W left (col 2..3): col 2 and col 3 are yellow solid (3) -> bottomW = 1.0
  grid[2 * cols + 2] = { type: '█', fgIndex: 3, bgIndex: 3, span: 1, r: 2, c: 2, isSolid: true };
  grid[2 * cols + 3] = { type: '█', fgIndex: 3, bgIndex: 3, span: 1, r: 2, c: 3, isSolid: true };
  // W right (col 7..8): col 7 is black solid (0), col 8 is yellow solid (3) -> boundary at col 8 (bottomW = 0.5)
  grid[2 * cols + 7] = { type: '█', fgIndex: 0, bgIndex: 0, span: 1, r: 2, c: 7, isSolid: true };
  grid[2 * cols + 8] = { type: '█', fgIndex: 3, bgIndex: 3, span: 1, r: 2, c: 8, isSolid: true };
  // A right (col 11..12): col 11 is ▃ (top edge black 0), col 12 is black solid (0) -> bottomW = 1.0
  grid[2 * cols + 11] = { type: '▃', fgIndex: 3, bgIndex: 0, span: 2, r: 2, c: 11 };
  grid[2 * cols + 12] = grid[2 * cols + 11];

  const recordPolygon = (r, c, span) => {
    const pts = [];
    const ctx = {
      fillStyle: '',
      beginPath() {
        pts.length = 0;
      },
      moveTo(x, y) {
        pts.push({ x, y });
      },
      lineTo(x, y) {
        pts.push({ x, y });
      },
      rect() {},
      closePath() {},
      fill() {},
      fillRect() {},
    };
    const cell = grid[r * cols + c];
    const item = {
      type: cell.type,
      x: 0,
      y: 0,
      w: 20 * span,
      h: 20,
      r,
      c,
      fgIndex: cell.fgIndex,
      bgIndex: cell.bgIndex,
      span,
    };
    SmoothAnsiArt.drawBlock(ctx, item, grid, cols, rows, 20, 20);
    return pts;
  };

  // 1. W left (col 2..3): must slope \ (top right-edge X < bottom right-edge X) and have only 4 vertices (no < valley)
  const wLeftPts = recordPolygon(1, 2, 2);
  assert.equal(wLeftPts.length, 4, 'W left edge should be a clean 4-vertex trapezoid without a < valley');
  const wLeftTopX = wLeftPts[1].x;
  const wLeftBottomX = wLeftPts[2].x;
  assert.ok(
    wLeftTopX < wLeftBottomX,
    `W left edge must slope \\ (topX=${wLeftTopX} < bottomX=${wLeftBottomX})`
  );

  // 2. W right (col 7..8): must slope / (top right-edge X > bottom right-edge X)
  const wRightPts = recordPolygon(1, 7, 2);
  assert.equal(wRightPts.length, 4, 'W right edge should be a 4-vertex trapezoid');
  const wRightTopX = wRightPts[1].x;
  const wRightBottomX = wRightPts[2].x;
  assert.ok(
    wRightTopX > wRightBottomX,
    `W right edge must slope / (topX=${wRightTopX} > bottomX=${wRightBottomX})`
  );

  // 3. A right (col 11..12): must slope \ (top right-edge X < bottom right-edge X)
  const aRightPts = recordPolygon(1, 11, 2);
  assert.equal(aRightPts.length, 4, 'A right edge should be a 4-vertex trapezoid');
  const aRightTopX = aRightPts[1].x;
  const aRightBottomX = aRightPts[2].x;
  assert.ok(
    aRightTopX < aRightBottomX,
    `A right edge must slope \\ (topX=${aRightTopX} < bottomX=${aRightBottomX})`
  );
});

test('Solid background cells touching fractional ramps emit sloped continuation wedges', () => {
  const cols = 6;
  const rows = 3;
  const grid = new Array(rows * cols).fill(null);

  // Row 0: col 1 is yellow (3), col 2 is black (0) -> vertical transition between col 1 and col 2
  grid[0 * cols + 1] = { type: '█', fgIndex: 3, bgIndex: 3, span: 1, r: 0, c: 1, w: 20, h: 20, isSolid: true };
  grid[0 * cols + 2] = { type: '█', fgIndex: 0, bgIndex: 0, span: 1, r: 0, c: 2, w: 20, h: 20, isSolid: true };

  // Row 1: col 1..2 is ▊ fg=3 bg=0 (fractional ramp continuing that transition across Row 1; boundary at 2.5 inside col 2)
  grid[1 * cols + 1] = { type: '▊', fgIndex: 3, bgIndex: 0, span: 2, r: 1, c: 1, w: 40, h: 20 };
  grid[1 * cols + 2] = grid[1 * cols + 1];

  // Row 2: col 2 is yellow (3), col 3 is black (0)
  grid[2 * cols + 2] = { type: '█', fgIndex: 3, bgIndex: 3, span: 1, r: 2, c: 2, w: 20, h: 20, isSolid: true };
  grid[2 * cols + 3] = { type: '█', fgIndex: 0, bgIndex: 0, span: 1, r: 2, c: 3, w: 20, h: 20, isSolid: true };

  const wedges = [];
  const buckets = Array.from({ length: 16 }, () => []);
  SmoothAnsiArt.collectSolidRampWedges(
    grid,
    cols,
    rows,
    buckets,
    (type, r, c, x, y, w, h, fgIndex, bgIndex, clip, span) => {
      const item = { type, r, c, x, y, w, h, fgIndex, bgIndex, clip, span };
      wedges.push(item);
      return item;
    }
  );
  assert.ok(wedges.length > 0, 'Should emit solid continuation wedges for Row 0 and/or Row 2 adjacent to fractional ramp');
  const row0Wedge = wedges.find((w) => w.r === 0 && w.c === 2);
  assert.ok(row0Wedge, 'Row 0 Col 2 solid cell should receive a left-side continuation wedge');
  assert.equal(row0Wedge.fgIndex, 3, 'Complement wedge color should match adjacent cell color (3)');
  assert.equal(row0Wedge.isSolidWedge, 'left', 'Row 0 Col 2 wedge should be on the left side');
});

test('Flat horizontal lower-block bars adjacent to solid blocks remain flat without diagonal endpoint beveling', () => {
  const cols = 5;
  const rows = 1;
  const grid = new Array(cols).fill(null);

  // Col 0: black solid block (fg=0, bg=0)
  grid[0] = { type: '█', fgIndex: 0, bgIndex: 0, span: 1, r: 0, c: 0, w: 20, h: 20, isSolid: true };
  // Col 1..2: flat ▂ bar (fg=0, bg=3, span=2)
  grid[1] = { type: '▂', fgIndex: 0, bgIndex: 3, span: 2, r: 0, c: 1, w: 40, h: 20 };
  grid[2] = grid[1];
  // Col 3..4: flat ▂ bar (fg=0, bg=3, span=2)
  grid[3] = { type: '▂', fgIndex: 0, bgIndex: 3, span: 2, r: 0, c: 3, w: 40, h: 20 };
  grid[4] = grid[3];

  const pts = [];
  const rects = [];
  const ctx = {
    fillStyle: '',
    beginPath() {
      pts.length = 0;
    },
    moveTo(x, y) {
      pts.push({ x, y });
    },
    lineTo(x, y) {
      pts.push({ x, y });
    },
    rect(x, y, w, h) {
      rects.push({ x, y, w, h });
    },
    closePath() {},
    fill() {},
    fillRect() {},
  };

  const item = {
    type: '▂',
    x: 0,
    y: 0,
    w: 40,
    h: 20,
    r: 0,
    c: 1,
    fgIndex: 0,
    bgIndex: 3,
    span: 2,
  };
  SmoothAnsiArt.drawBlock(ctx, item, grid, cols, rows, 20, 20);

  // When leftY == rightY, drawLowerBlockRamp draws a crisp rectangle via ctx.rect(x, topY, w, h - topY)
  assert.equal(pts.length, 0, 'Flat horizontal bar should not emit diagonal polygon vertices');
  assert.equal(rects.length, 1, 'Flat horizontal bar should be drawn as a single crisp rectangle');
  assert.equal(rects[0].y, 15, 'Top edge of ▂ bar should stay at 0.75 * h (15), not bevel up toward 0');
});

