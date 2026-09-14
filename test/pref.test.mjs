import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_PREFS,
  PREF_STORAGE_KEY,
  getDefaultFontSize,
  getDefaultPrefs,
  parseDefaultPlugins,
  parseDefaultPrefs,
  readValuesWithDefault,
  writeValues,
  updatePrefs,
  updatePref,
} from '../src/js/pref.js';

class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

test('getDefaultPrefs returns default preferences with cloned termSize', () => {
  const prefs = getDefaultPrefs();
  assert.equal(prefs.enableMediaPreviewer, true);
  assert.equal(prefs.fontSize, 24);
  assert.equal(prefs.smoothAnsiArt, true);
  assert.equal(prefs.termSizeMode, 'fixed-term-size');
  assert.deepEqual(prefs.termSize, { cols: 80, rows: 24 });

  // Mutating the returned termSize must not mutate DEFAULT_PREFS
  prefs.termSize.cols = 132;
  assert.equal(DEFAULT_PREFS.termSize.cols, 80);
});

test('readValuesWithDefault returns defaults when localStorage is empty or unavailable', () => {
  const originalWindow = globalThis.window;
  try {
    // 1. window is undefined
    delete globalThis.window;
    assert.deepEqual(readValuesWithDefault(), getDefaultPrefs());

    // 2. window exists but localStorage is empty
    globalThis.window = { localStorage: new MockLocalStorage() };
    assert.deepEqual(readValuesWithDefault(), getDefaultPrefs());
  } finally {
    globalThis.window = originalWindow;
  }
});

test('readValuesWithDefault merges saved values with defaults', () => {
  const originalWindow = globalThis.window;
  try {
    const mockStorage = new MockLocalStorage();
    globalThis.window = { localStorage: mockStorage };

    mockStorage.setItem(
      PREF_STORAGE_KEY,
      JSON.stringify({
        values: {
          fontSize: 28,
          enableMouseBrowsing: true,
          antiIdleTime: 60,
        },
      })
    );

    const prefs = readValuesWithDefault();
    assert.equal(prefs.fontSize, 28);
    assert.equal(prefs.enableMouseBrowsing, true);
    assert.equal(prefs.antiIdleTime, 60);
    // Unchanged keys keep default values
    assert.equal(prefs.enableMediaPreviewer, DEFAULT_PREFS.enableMediaPreviewer);
    assert.deepEqual(prefs.termSize, DEFAULT_PREFS.termSize);
  } finally {
    globalThis.window = originalWindow;
  }
});

test('readValuesWithDefault preserves partial termSize configuration', () => {
  const originalWindow = globalThis.window;
  try {
    const mockStorage = new MockLocalStorage();
    globalThis.window = { localStorage: mockStorage };

    mockStorage.setItem(
      PREF_STORAGE_KEY,
      JSON.stringify({
        values: {
          termSize: { cols: 120 },
        },
      })
    );

    const prefs = readValuesWithDefault();
    assert.equal(prefs.termSize.cols, 120);
    assert.equal(prefs.termSize.rows, 24); // default preserved
  } finally {
    globalThis.window = originalWindow;
  }
});


test('readValuesWithDefault migrates legacy max-font-size to fixed-term-size and resets invalid fontSize 999', () => {
  const originalWindow = globalThis.window;
  try {
    const mockStorage = new MockLocalStorage();
    globalThis.window = { localStorage: mockStorage };

    // Case 1: max-font-size with 999 resets to fixed-term-size and default fontSize
    mockStorage.setItem(
      PREF_STORAGE_KEY,
      JSON.stringify({
        values: {
          fontSize: 999,
          maxFontSize: 999,
          termSizeMode: 'max-font-size',
        },
      })
    );
    let prefs = readValuesWithDefault();
    assert.equal(prefs.termSizeMode, 'fixed-term-size');
    assert.equal(prefs.fontSize, 24);
    assert.equal(prefs.maxFontSize, undefined);

    // Case 2: max-font-size always migrates to fixed-term-size cleanly
    mockStorage.setItem(
      PREF_STORAGE_KEY,
      JSON.stringify({
        values: {
          fontSize: 36,
          maxFontSize: 36,
          termSizeMode: 'max-font-size',
        },
      })
    );
    prefs = readValuesWithDefault();
    assert.equal(prefs.termSizeMode, 'fixed-term-size');
    assert.equal(prefs.fontSize, 36);
    assert.equal(prefs.maxFontSize, undefined);
  } finally {
    globalThis.window = originalWindow;
  }
});

test('readValuesWithDefault gracefully recovers from corrupted JSON in localStorage', () => {
  const originalWindow = globalThis.window;
  try {
    const mockStorage = new MockLocalStorage();
    globalThis.window = { localStorage: mockStorage };

    mockStorage.setItem(PREF_STORAGE_KEY, 'invalid-json{{{');
    const prefs = readValuesWithDefault();
    assert.deepEqual(prefs, getDefaultPrefs());
  } finally {
    globalThis.window = originalWindow;
  }
});

test('writeValues serializes values object into localStorage', () => {
  const originalWindow = globalThis.window;
  try {
    const mockStorage = new MockLocalStorage();
    globalThis.window = { localStorage: mockStorage };

    const customValues = { fontSize: 30, lineWrap: 80 };
    const returned = writeValues(customValues);
    assert.equal(returned, customValues);

    const raw = mockStorage.getItem(PREF_STORAGE_KEY);
    assert.ok(raw);
    const parsed = JSON.parse(raw);
    assert.deepEqual(parsed.values, customValues);
  } finally {
    globalThis.window = originalWindow;
  }
});

test('updatePrefs patches existing preferences and preserves other keys', () => {
  const originalWindow = globalThis.window;
  try {
    const mockStorage = new MockLocalStorage();
    globalThis.window = { localStorage: mockStorage };

    writeValues({ fontSize: 20, enableFpsMeter: false });

    const updated = updatePrefs({ enableFpsMeter: true, copyOnSelect: true });
    assert.deepEqual(updated, {
      fontSize: 20,
      enableFpsMeter: true,
      copyOnSelect: true,
    });

    const parsed = JSON.parse(mockStorage.getItem(PREF_STORAGE_KEY));
    assert.deepEqual(parsed.values, {
      fontSize: 20,
      enableFpsMeter: true,
      copyOnSelect: true,
    });
  } finally {
    globalThis.window = originalWindow;
  }
});

test('updatePref patches a single preference key', () => {
  const originalWindow = globalThis.window;
  try {
    const mockStorage = new MockLocalStorage();
    globalThis.window = { localStorage: mockStorage };

    writeValues({ antiIdleTime: 0 });
    updatePref('antiIdleTime', 120);

    const parsed = JSON.parse(mockStorage.getItem(PREF_STORAGE_KEY));
    assert.equal(parsed.values.antiIdleTime, 120);
  } finally {
    globalThis.window = originalWindow;
  }
});

test('enableBell defaults to always and preserves string values', () => {
  const originalWindow = globalThis.window;
  try {
    const mockStorage = new MockLocalStorage();
    globalThis.window = { localStorage: mockStorage };

    // 1. Default value
    const defaultPrefs = readValuesWithDefault();
    assert.equal(defaultPrefs.enableBell, 'always');

    // 2. Explicit string values preserved
    mockStorage.setItem(
      PREF_STORAGE_KEY,
      JSON.stringify({ values: { enableBell: 'background' } })
    );
    assert.equal(readValuesWithDefault().enableBell, 'background');

    mockStorage.setItem(
      PREF_STORAGE_KEY,
      JSON.stringify({ values: { enableBell: 'off' } })
    );
    assert.equal(readValuesWithDefault().enableBell, 'off');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('parseDefaultPlugins parses JSON dictionary and +plugin/-plugin string formats', () => {
  // 1. JSON string format with snake_case IDs and enablePascalCase keys
  assert.deepEqual(
    parseDefaultPlugins('{"easy_reading":true,"mouse_browsing":false,"enableTouchDebugHUD":true}'),
    {
      enableEasyReading: true,
      enableMouseBrowsing: false,
      enableTouchDebugHUD: true,
    }
  );

  // 2. Comma-separated string format (+plugin, -plugin, !plugin, plugin)
  assert.deepEqual(
    parseDefaultPlugins('+easy_reading, -media_previewer, !auto_wrap, fps_meter'),
    {
      enableEasyReading: true,
      enableMediaPreviewer: false,
      enableAutoWrap: false,
      enableFpsMeter: true,
    }
  );

  // 3. Unknown plugin keys are ignored safely
  assert.deepEqual(
    parseDefaultPlugins('{"unknown_plugin":true,"easy_reading":true}'),
    {
      enableEasyReading: true,
    }
  );
});

test('getDefaultPrefs applies process.env.DEFAULT_PLUGINS overrides while preserving user saved prefs', () => {
  const originalEnv = process.env.DEFAULT_PLUGINS;
  const originalWindow = globalThis.window;
  try {
    process.env.DEFAULT_PLUGINS = '{"easy_reading":true,"media_previewer":false,"virtual_keyboard":true}';

    const defaults = getDefaultPrefs();
    assert.equal(defaults.enableEasyReading, true);
    assert.equal(defaults.enableMediaPreviewer, false);
    assert.equal(defaults.enableVirtualKeyboard, true);
    // Unmentioned plugins retain built-in default
    assert.equal(defaults.enableLoginAssist, DEFAULT_PREFS.enableLoginAssist);

    // User's localStorage preferences still override site DEFAULT_PLUGINS
    const mockStorage = new MockLocalStorage();
    globalThis.window = { localStorage: mockStorage };
    mockStorage.setItem(
      PREF_STORAGE_KEY,
      JSON.stringify({
        values: {
          enableEasyReading: false,
          enableMediaPreviewer: true,
        },
      })
    );

    const effective = readValuesWithDefault();
    assert.equal(effective.enableEasyReading, false);
    assert.equal(effective.enableMediaPreviewer, true);
    assert.equal(effective.enableVirtualKeyboard, true);
  } finally {
    if (originalEnv === undefined) {
      delete process.env.DEFAULT_PLUGINS;
    } else {
      process.env.DEFAULT_PLUGINS = originalEnv;
    }
    globalThis.window = originalWindow;
  }
});

test('parseDefaultPrefs and getDefaultPrefs apply site-specific DEFAULT_PREFS', () => {
  assert.deepEqual(parseDefaultPrefs(''), {});
  assert.deepEqual(parseDefaultPrefs('invalid-json'), {});
  assert.deepEqual(parseDefaultPrefs('{"termSizeMode":"fixed-font-size","fontSize":28}'), {
    termSizeMode: 'fixed-font-size',
    fontSize: 28,
  });

  const originalEnv = process.env.DEFAULT_PREFS;
  try {
    process.env.DEFAULT_PREFS = JSON.stringify({
      termSizeMode: 'fixed-font-size',
      fontSize: 30,
      termSize: { cols: 100 },
    });
    const defaults = getDefaultPrefs();
    assert.equal(defaults.termSizeMode, 'fixed-font-size');
    assert.equal(defaults.fontSize, 30);
    assert.deepEqual(defaults.termSize, { cols: 100, rows: 24 });

    // Legacy max-font-size in DEFAULT_PREFS migrates directly to fixed-term-size
    process.env.DEFAULT_PREFS = JSON.stringify({
      termSizeMode: 'max-font-size',
      maxFontSize: 28,
    });
    const migrated = getDefaultPrefs();
    assert.equal(migrated.termSizeMode, 'fixed-term-size');
    assert.equal(migrated.maxFontSize, undefined);
  } finally {
    if (originalEnv === undefined) {
      delete process.env.DEFAULT_PREFS;
    } else {
      process.env.DEFAULT_PREFS = originalEnv;
    }
  }
});

test('readValuesWithDefault migrates legacy useMouseBrowsing preference key', () => {
  const originalWindow = globalThis.window;
  try {
    const mockStorage = new MockLocalStorage();
    globalThis.window = { localStorage: mockStorage };

    mockStorage.setItem(
      PREF_STORAGE_KEY,
      JSON.stringify({
        values: {
          useMouseBrowsing: true,
        },
      })
    );

    const prefs = readValuesWithDefault();
    assert.equal(prefs.enableMouseBrowsing, true);
  } finally {
    globalThis.window = originalWindow;
  }
});

test('readValuesWithDefault and DEFAULT_PLUGINS migrate legacy enableAutoLogin and auto_login keys', () => {
  const originalWindow = globalThis.window;
  const originalEnv = process.env.DEFAULT_PLUGINS;
  try {
    const mockStorage = new MockLocalStorage();
    globalThis.window = { localStorage: mockStorage };
    mockStorage.setItem(
      PREF_STORAGE_KEY,
      JSON.stringify({
        values: {
          enableAutoLogin: false,
        },
      })
    );

    const prefs = readValuesWithDefault();
    assert.equal(prefs.enableLoginAssist, false, 'readValuesWithDefault must migrate legacy enableAutoLogin to enableLoginAssist');

    // Also test DEFAULT_PLUGINS with legacy "auto_login" ID
    mockStorage.clear();
    process.env.DEFAULT_PLUGINS = '-auto_login';
    const defaults = getDefaultPrefs();
    assert.equal(defaults.enableLoginAssist, false, 'DEFAULT_PLUGINS "-auto_login" must disable enableLoginAssist');
  } finally {
    if (originalEnv === undefined) {
      delete process.env.DEFAULT_PLUGINS;
    } else {
      process.env.DEFAULT_PLUGINS = originalEnv;
    }
    globalThis.window = originalWindow;
  }
});

test('getDefaultFontSize and getDefaultPrefs calculate dual orientation defaults (fontSize for landscape, fontSizePortrait for portrait)', () => {
  const originalWindow = globalThis.window;
  const origUA = Object.getOwnPropertyDescriptor(globalThis.navigator, 'userAgent');
  const setUA = (ua) => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value: ua,
      configurable: true,
    });
  };
  try {
    setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');

    // 1. Desktop large window (1280x800) -> landscape 24, portrait 19
    globalThis.window = { innerWidth: 1280, innerHeight: 800 };
    assert.equal(getDefaultFontSize(), 24);
    assert.equal(getDefaultFontSize(false), 24);
    assert.equal(getDefaultFontSize(true), 19);
    assert.equal(getDefaultPrefs().fontSize, 24);
    assert.equal(getDefaultPrefs().fontSizePortrait, 19);

    // 2. Mobile portrait screen (390x844) -> current 9, landscape default 16, portrait default 9
    globalThis.window = { innerWidth: 390, innerHeight: 844 };
    assert.equal(getDefaultFontSize(), 9);
    assert.equal(getDefaultPrefs().fontSize, 16);
    assert.equal(getDefaultPrefs().fontSizePortrait, 9);

    // 3. Mobile landscape screen (844x390) -> current 16, landscape default 16, portrait default 9
    globalThis.window = { innerWidth: 844, innerHeight: 390 };
    assert.equal(getDefaultFontSize(), 16);
    assert.equal(getDefaultPrefs().fontSize, 16);
    assert.equal(getDefaultPrefs().fontSizePortrait, 9);

    // 4. Legacy single-fontSize profile migration on mobile screen
    const mockStorage = new MockLocalStorage();
    globalThis.window = { innerWidth: 390, innerHeight: 844, localStorage: mockStorage };
    mockStorage.setItem(
      PREF_STORAGE_KEY,
      JSON.stringify({
        values: {
          fontSize: 24,
        },
      })
    );
    const mobilePrefs = readValuesWithDefault();
    assert.equal(mobilePrefs.fontSize, 16, 'Legacy hardcoded 24 on mobile must migrate landscape fontSize to 16');
    assert.equal(mobilePrefs.fontSizePortrait, 9, 'Legacy profile must populate fontSizePortrait to 9');
  } finally {
    globalThis.window = originalWindow;
    if (origUA) {
      Object.defineProperty(globalThis.navigator, 'userAgent', origUA);
    }
  }
});

test('TermView applyTermSizeMode switches between fontSizePortrait and fontSize when viewport orientation changes', () => {
  const termViewSrc = fs.readFileSync(path.resolve('src/js/term_view.js'), 'utf-8');
  const applyMatch = termViewSrc.match(/applyTermSizeMode\(values, \{ isMobile = false, onResizeTerm \} = \{\}\) \{[\s\S]*?\n  \}/);
  const calcTermMatch = termViewSrc.match(/calcTermSizeFromFont\(fontSizePx\) \{[\s\S]*?\n  \}/);
  assert.ok(applyMatch, 'applyTermSizeMode must exist in TermView');

  let lastResizedFont = null;
  const mockView = {
    buf: {
      cols: 80,
      rows: 24,
      site: { clampTermSize: (cols, rows) => ({ cols, rows }) },
    },
    termWidth: 0,
    termHeight: 0,
    innerBounds: { width: 390, height: 844 },
    lineHeight: 1.0,
    getWindowInnerBounds() {
      return this.innerBounds;
    },
    fixedResize(fontSizePx) {
      lastResizedFont = fontSizePx;
    },
    fontResize() {},
    redraw() {},
    setTransFix() {},
  };

  mockView.calcTermSizeFromFont = new Function(
    'fontSizePx',
    calcTermMatch[0].replace(/^calcTermSizeFromFont\(fontSizePx\)\s*\{/, '').replace(/\}$/, '')
  ).bind(mockView);
  mockView.applyTermSizeMode = new Function(
    'DEFAULT_PREFS',
    `return function ${applyMatch[0]}`
  )(DEFAULT_PREFS).bind(mockView);

  const prefs = {
    termSizeMode: 'fixed-term-size',
    fontSize: 16,
    fontSizePortrait: 10,
  };

  // 1. Portrait viewport (390x844) -> uses fontSizePortrait (10px)
  mockView.innerBounds = { width: 390, height: 844 };
  mockView.applyTermSizeMode(prefs, { isMobile: true });
  assert.equal(lastResizedFont, 10);

  // 2. Rotate to Landscape viewport (844x390) -> resizer switches to fontSize (16px)
  mockView.innerBounds = { width: 844, height: 390 };
  mockView.resizer();
  assert.equal(lastResizedFont, 16);

  // 3. Rotate back to Portrait viewport (390x844) -> resizer switches back to fontSizePortrait (10px)
  mockView.innerBounds = { width: 390, height: 844 };
  mockView.resizer();
  assert.equal(lastResizedFont, 10);
});

test('TermView fontResize scales beyond 24px in fixed-term-size mode on large viewports', () => {
  const termViewSrc = fs.readFileSync(path.resolve('src/js/term_view.js'), 'utf-8');
  const fontResizeMatch = termViewSrc.match(/fontResize\(\) \{[\s\S]*?\n  \}/);
  assert.ok(fontResizeMatch, 'fontResize must exist in TermView');

  let lastResizedFont = null;
  const mockView = {
    buf: { cols: 80, rows: 24 },
    termWidth: 0,
    termHeight: 0,
    innerBounds: { width: 1920, height: 1080 },
    lineHeight: 1.0,
    chw: 12,
    chh: 24,
    fixedResize(fontSizePx) {
      lastResizedFont = fontSizePx;
    },
  };

  mockView.fontResize = new Function(
    fontResizeMatch[0].replace(/^fontResize\(\)\s*\{/, '').replace(/\}$/, '')
  ).bind(mockView);

  mockView.fontResize();
  assert.equal(lastResizedFont, 44, 'fontResize on 1920x1080 must scale to 44px and not be capped at 24px');
});
