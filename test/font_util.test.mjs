import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseFontList,
  serializeFontList,
  PRESET_FONTS,
  isFontAvailable,
  filterAvailableFonts,
  getAsciiWidthRatio,
  getAsciiLetterSpacingEm,
  wrapAsciiHtml,
} from "../src/js/font_util.js";

test("parseFontList correctly handles quoted and unquoted font names", () => {
  const input =
    "MingLiu,SymMingLiu,'Noto Sans Mono CJK TC',\"PingFang TC\",monospace";
  const expected = [
    "MingLiu",
    "SymMingLiu",
    "Noto Sans Mono CJK TC",
    "PingFang TC",
    "monospace",
  ];
  assert.deepEqual(parseFontList(input), expected);
});

test("parseFontList handles spaces and empty segments gracefully", () => {
  const input = "  MingLiu , ,  'Noto Sans' ,   monospace  ";
  const expected = ["MingLiu", "Noto Sans", "monospace"];
  assert.deepEqual(parseFontList(input), expected);
});

test("parseFontList handles empty or non-string inputs", () => {
  assert.deepEqual(parseFontList(""), []);
  assert.deepEqual(parseFontList(null), []);
  assert.deepEqual(parseFontList(undefined), []);
  assert.deepEqual(parseFontList(123), []);
});

test("serializeFontList quotes names with spaces and preserves existing quotes", () => {
  const list = [
    "MingLiu",
    "Noto Sans Mono CJK TC",
    '"PingFang TC"',
    "monospace",
  ];
  const expected =
    "MingLiu, 'Noto Sans Mono CJK TC', \"PingFang TC\", monospace";
  assert.equal(serializeFontList(list), expected);
});

test("serializeFontList handles empty or non-array inputs", () => {
  assert.equal(serializeFontList([]), "");
  assert.equal(serializeFontList(null), "");
  assert.equal(serializeFontList(undefined), "");
});

test("parseFontList and serializeFontList round-trip without data loss", () => {
  const original = [
    "MingLiu",
    "SymMingLiu",
    "Noto Sans Mono CJK TC",
    "PingFang TC",
    "monospace",
  ];
  const serialized = serializeFontList(original);
  const reParsed = parseFontList(serialized);
  assert.deepEqual(reParsed, original);
});

test("PRESET_FONTS includes standard terminal fonts", () => {
  assert(PRESET_FONTS.includes("MingLiu"));
  assert(PRESET_FONTS.includes("SymMingLiu"));
  assert(PRESET_FONTS.includes("Noto Sans Mono CJK TC"));
  assert(PRESET_FONTS.includes("monospace"));
});

test("isFontAvailable verifies whether a font family is installed via canvas measureText", () => {
  const installedSet = new Set(["Cubic 11", "細明體", "DFKai-SB"]);
  let currentFont = "";
  const mockCanvas = {
    getContext: () => ({
      set font(val) {
        currentFont = val;
      },
      get font() {
        return currentFont;
      },
      measureText: () => {
        for (const inst of installedSet) {
          if (currentFont.includes(`"${inst}"`)) {
            return { width: 250 };
          }
        }
        if (currentFont.endsWith("monospace")) return { width: 100 };
        if (currentFont.endsWith("sans-serif")) return { width: 110 };
        if (currentFont.endsWith("serif")) return { width: 120 };
        return { width: 100 };
      },
    }),
  };

  assert.equal(isFontAvailable("Cubic 11", mockCanvas), true);
  assert.equal(isFontAvailable("細明體", mockCanvas), true);
  assert.equal(isFontAvailable("NonExistentFont123", mockCanvas), false);
  assert.equal(isFontAvailable("monospace", mockCanvas), true);
  assert.equal(isFontAvailable("SymMingLiu", mockCanvas), true);
  assert.equal(isFontAvailable("", mockCanvas), false);

  let capturedFonts = [];
  const captureCanvas = {
    getContext: () => ({
      set font(val) {
        capturedFonts.push(val);
      },
      measureText: () => ({ width: 100 }),
    }),
  };
  isFontAvailable('Test\\Font"Name', captureCanvas);
  assert(
    capturedFonts.some((f) => f.includes('"Test\\\\Font\\"Name"')),
    "Backslashes and double quotes should both be escaped in canvas font string",
  );

  const filtered = filterAvailableFonts(
    ["MingLiu", "Cubic 11", "NonExistentFont123", "SymMingLiu", "monospace"],
    mockCanvas,
  );
  assert.deepEqual(filtered, ["Cubic 11", "SymMingLiu", "monospace"]);
});

test("FontManager filters preset fonts by availability and validates custom font input", () => {
  const fontManagerPath = path.resolve(
    "src/components/Settings/FontManager.js",
  );
  const src = fs.readFileSync(fontManagerPath, "utf-8");

  assert(
    src.includes('"queryLocalFonts" in window'),
    "FontManager should check queryLocalFonts in window",
  );
  assert(
    src.includes("!canQueryLocalFonts") && src.includes('value="__custom__"'),
    "FontManager select should show custom font option only when queryLocalFonts is unsupported",
  );
  assert(
    src.includes("filterAvailableFonts(PRESET_FONTS)"),
    "FontManager should filter PRESET_FONTS using filterAvailableFonts before rendering options",
  );
  assert(
    src.includes("pruneUnavailableFonts()") &&
      src.includes("filterAvailableFonts(parseFontList(this.props.value))"),
    "FontManager should prune unavailable fonts from the active font list on mount and render",
  );
  assert(
    src.includes("isFontAvailable(target)"),
    "FontManager should verify font existence before adding custom font",
  );
  assert(
    src.includes("options_fontList_notFound"),
    "FontManager should display error message when custom font is not found",
  );
  assert(
    src.includes("FontManager__Actions") &&
      src.indexOf("FontManager__List") < src.indexOf("FontManager__Actions") &&
      src.indexOf("FontManager__Actions") < src.indexOf("FontManager__AddBox") &&
      src.indexOf("FontManager__Actions") < src.indexOf("this.handleQueryLocalFonts") &&
      src.indexOf("FontManager__Actions") < src.indexOf("this.handleRestoreDefault"),
    "FontManager should render query local fonts and restore default buttons above AddBox",
  );

  const zhMessages = JSON.parse(
    fs.readFileSync(path.resolve("src/_locales/zh_TW/messages.json"), "utf-8"),
  );
  const enMessages = JSON.parse(
    fs.readFileSync(path.resolve("src/_locales/en/messages.json"), "utf-8"),
  );
  assert(zhMessages.options_fontList_customOption?.message);
  assert(zhMessages.options_fontList_customPlaceholder?.message);
  assert(zhMessages.options_fontList_backToSelect?.message);
  assert(zhMessages.options_fontList_notFound?.message);
  assert(enMessages.options_fontList_customOption?.message);
  assert(enMessages.options_fontList_customPlaceholder?.message);
  assert(enMessages.options_fontList_backToSelect?.message);
  assert(enMessages.options_fontList_notFound?.message);
});

test("FontManager handleAdd places newly added font at top priority (index 0)", () => {
  const fontManagerPath = path.resolve(
    "src/components/Settings/FontManager.js",
  );
  const src = fs.readFileSync(fontManagerPath, "utf-8");
  const handleAddMatch = src.match(/handleAdd = \(fontName\) => \{[\s\S]*?\n  \};/);
  assert(handleAddMatch, "FontManager must define handleAdd method");

  let updatedList = null;
  const mockManager = {
    state: {
      isCustomInput: false,
      selectedFont: "DFKai-SB",
      customFontName: "",
    },
    getFontList: () => ["MingLiu", "monospace"],
    updateFontList: (list) => {
      updatedList = list;
    },
    setState: (s) => {
      Object.assign(mockManager.state, s);
    },
  };

  const fnBody = handleAddMatch[0]
    .replace(/^handleAdd = \(fontName\) => \{/, "")
    .replace(/\};$/, "");
  const runHandleAdd = new Function(
    "fontName",
    "parseFontList",
    "isFontAvailable",
    "_",
    fnBody,
  ).bind(mockManager);

  // 1. Add a new font -> placed at index 0
  runHandleAdd(
    undefined,
    (s) => [s],
    () => true,
    (k) => k,
  );
  assert.deepEqual(updatedList, ["DFKai-SB", "MingLiu", "monospace"]);

  // 2. Re-adding an existing lower-priority font moves it to index 0
  mockManager.state.selectedFont = "monospace";
  mockManager.getFontList = () => ["DFKai-SB", "MingLiu", "monospace"];
  runHandleAdd(
    undefined,
    (s) => [s],
    () => true,
    (k) => k,
  );
  assert.deepEqual(updatedList, ["monospace", "DFKai-SB", "MingLiu"]);
});

test("getAsciiWidthRatio and getAsciiLetterSpacingEm compute letter-spacing compensation for Courier and wide monospace fonts", () => {
  // 1. Canvas measurement simulation: Courier (60px per 100px = 0.6em) vs MingLiu (50px per 100px = 0.5em)
  const courierCanvas = {
    getContext: () => ({
      measureText: (str) => ({ width: str.length * 60 }),
    }),
  };
  const mingliuCanvas = {
    getContext: () => ({
      measureText: (str) => ({ width: str.length * 50 }),
    }),
  };

  assert.equal(getAsciiWidthRatio("Courier, MingLiu", courierCanvas), 0.6);
  assert.equal(getAsciiLetterSpacingEm("Courier, MingLiu", courierCanvas), -0.1);

  assert.equal(getAsciiWidthRatio("MingLiu, monospace", mingliuCanvas), 0.5);
  assert.equal(getAsciiLetterSpacingEm("MingLiu, monospace", mingliuCanvas), 0);

  // 2. Fallback heuristic when canvas is unavailable
  assert.equal(getAsciiWidthRatio("Courier, SymMingLiu, MingLiu", null), 0.6);
  assert.equal(getAsciiLetterSpacingEm("Courier, SymMingLiu, MingLiu", null), -0.1);
  assert.equal(getAsciiLetterSpacingEm("'Courier New', MingLiu", null), -0.1);
  assert.equal(getAsciiLetterSpacingEm("Consolas, MingLiu", null), -0.05);
  assert.equal(getAsciiLetterSpacingEm("MingLiu, SymMingLiu, monospace", null), 0);
});

test("wrapAsciiHtml wraps printable ASCII runs outside HTML tags in .term-ascii spans", () => {
  const input = '<span class="q1 b7"> [好讀模式] </span><span class="q2 b7">(100%) </span>';
  const output = wrapAsciiHtml(input);
  assert.equal(
    output,
    '<span class="q1 b7"><span class="term-ascii"> [</span>好讀模式<span class="term-ascii">] </span></span><span class="q2 b7"><span class="term-ascii">(100%) </span></span>',
  );
});

test("TermView, EasyReading, ColorSegmentBuilder, and main.css prevent Courier width overflow and clipping", () => {
  const mainCss = fs.readFileSync(path.resolve("src/css/main.css"), "utf-8");
  const termViewSrc = fs.readFileSync(path.resolve("src/js/term_view.js"), "utf-8");
  const easyReadingSrc = fs.readFileSync(
    path.resolve("src/plugins/easy_reading/EasyReading.js"),
    "utf-8",
  );
  const wordBuilderSrc = fs.readFileSync(
    path.resolve("src/components/Row/WordSegmentBuilder/index.js"),
    "utf-8",
  );

  // 1. CSS defines .term-ascii letter-spacing using --term-ascii-ls
  assert(
    mainCss.includes(".term-ascii") &&
      mainCss.includes("letter-spacing: var(--term-ascii-ls, 0px)"),
    "main.css must define .term-ascii with letter-spacing: var(--term-ascii-ls, 0px)",
  );

  // 2. WordSegmentBuilder wraps 1-column ASCII runs in .term-ascii spans
  assert(
    wordBuilderSrc.includes('className="term-ascii"'),
    "WordSegmentBuilder must wrap non-DBCS ASCII characters in .term-ascii spans",
  );

  // 3. TermView sets --term-ascii-ls on termWin and emits asciiLetterSpacing
  assert(
    termViewSrc.includes("getAsciiLetterSpacingEm(this.fontFace)") &&
      termViewSrc.includes("setProperty('--term-ascii-ls', this.asciiLetterSpacing)"),
    "TermView must calculate asciiLetterSpacing and set --term-ascii-ls on termWin",
  );

  // 4. EasyReading sets --term-ascii-ls on overlay and scales --term-chw when container is narrow
  assert(
    easyReadingSrc.includes("setProperty('--term-ascii-ls', ls)") &&
      easyReadingSrc.includes("wrapAsciiHtml"),
    "EasyReading must set --term-ascii-ls on overlay and wrap prompt ASCII runs",
  );

  // 5. TermView initializes chw/chh/fixedResize in constructor and refreshes on document.fonts ready/loadingdone
  assert(
    termViewSrc.includes("this.fixedResize(this.fontSizePx)") &&
      termViewSrc.includes("document.fonts.ready") &&
      termViewSrc.includes("loadingdone"),
    "TermView must initialize fixedResize in constructor and listen to document.fonts for DOM mode",
  );
});

test("getAsciiWidthRatio and getAsciiLetterSpacingEm prevent squished text in DOM mode at startup before SymMingLiu webfont loads or with proportional fonts", () => {
  // 1. Proportional font simulation (e.g. PingFang TC where 'M' is 85px and 'i' is 25px)
  const pingfangCanvas = {
    getContext: () => ({
      measureText: (str) => ({
        width: str.includes("M") ? str.length * 85 : str.length * 25,
      }),
    }),
  };
  assert.equal(
    getAsciiWidthRatio("'PingFang TC', sans-serif", pingfangCanvas),
    0.5,
    "Proportional fonts where width('M') !== width('i') must not return 0.85 ratio",
  );
  assert.equal(
    getAsciiLetterSpacingEm("'PingFang TC', sans-serif", pingfangCanvas),
    0,
    "Proportional fonts must receive 0 letter-spacing instead of -0.35em squishing",
  );

  // 2. Browser startup simulation where MingLiu is not installed and SymMingLiu woff2 is not yet loaded in Canvas
  const origDoc = globalThis.document;
  try {
    globalThis.document = {
      createElement: (tag) => {
        if (tag === "canvas") {
          return {
            getContext: () => ({
              font: "",
              measureText(str) {
                // Simulate macOS without MingLiu: only PingFang TC / monospace are installed in Canvas
                if (this.font.includes("MingLiu") && !this.font.includes("PingFang")) {
                  // Uninstalled font falls back to default in isFontAvailable check
                  return { width: str.length * 50 };
                }
                // If Canvas falls back to proportional PingFang TC for M vs i
                if (str === "MMMMMMMMMM") return { width: 850 };
                if (str === "iiiiiiiiii") return { width: 250 };
                return { width: str.length * 50 };
              },
            }),
          };
        }
        return null;
      },
    };

    const defaultStack =
      "MingLiu,SymMingLiu,'Noto Sans Mono CJK TC','PingFang TC',monospace";
    assert.equal(
      getAsciiWidthRatio(defaultStack),
      0.5,
      "Default font stack with SymMingLiu must resolve to 0.5em even before webfont loads in Canvas",
    );
    assert.equal(
      getAsciiLetterSpacingEm(defaultStack),
      0,
      "Default font stack must have 0 letter-spacing at startup in DOM mode",
    );
  } finally {
    globalThis.document = origDoc;
  }
});
