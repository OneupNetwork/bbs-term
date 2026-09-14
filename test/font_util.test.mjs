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



