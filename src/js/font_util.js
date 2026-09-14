/**
 * Parses a CSS font-family string into an array of clean font names.
 * Supports single-quoted, double-quoted, and unquoted font names.
 *
 * @param {string} fontFaceStr - e.g. "MingLiu, 'Noto Sans Mono CJK TC', monospace"
 * @returns {string[]} Array of font family names
 */
export function parseFontList(fontFaceStr) {
  if (!fontFaceStr || typeof fontFaceStr !== "string") {
    return [];
  }
  const result = [];
  const regex = /\s*(?:['"]([^'"]+)['"]|([^,]+))\s*(?:,|$)/g;
  let match;
  while ((match = regex.exec(fontFaceStr)) !== null) {
    const font = (match[1] !== undefined ? match[1] : match[2] || "").trim();
    if (font) {
      result.push(font);
    }
  }
  return result;
}

/**
 * Serializes an array of font names into a valid CSS font-family string.
 * Quotes font names that contain spaces or special characters if not already quoted.
 *
 * @param {string[]} fontList - e.g. ["MingLiu", "Noto Sans Mono CJK TC", "monospace"]
 * @returns {string} e.g. "MingLiu, 'Noto Sans Mono CJK TC', monospace"
 */
export function serializeFontList(fontList) {
  if (!Array.isArray(fontList)) {
    return "";
  }
  return fontList
    .map((f) => {
      const trimmed = (f || "").trim();
      if (!trimmed) return "";
      if (
        (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
      ) {
        return trimmed;
      }
      if (/[ \t\r\n]/.test(trimmed)) {
        return `'${trimmed}'`;
      }
      return trimmed;
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * Curated preset fonts popular for terminal rendering.
 */
export const PRESET_FONTS = [
  "MingLiu",
  "PMingLiU",
  "SymMingLiu",
  "DFKai-SB",
  "Noto Sans Mono CJK TC",
  "PingFang TC",
  "Heiti TC",
  "Microsoft JhengHei",
  "Sarasa Mono TC",
  "Iosevka",
  "Cascadia Code",
  "Consolas",
  "Menlo",
  "Monaco",
  "SF Mono",
  "Courier New",
  "Fira Code",
  "JetBrains Mono",
  "Ubuntu Mono",
  "DejaVu Sans Mono",
  "Liberation Mono",
  "Source Code Pro",
  "monospace",
];

/**
 * Checks whether a font family is available on the system using 2D Canvas
 * text measurement comparison against CSS generic fallback families.
 *
 * @param {string} fontName - Font family name to check
 * @param {HTMLCanvasElement} [customCanvas] - Optional canvas element for testing
 * @returns {boolean} True if the font is installed/available
 */
export function isFontAvailable(fontName, customCanvas) {
  if (!fontName || typeof fontName !== "string") {
    return false;
  }
  const trimmed = fontName.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  if (
    [
      "monospace",
      "sans-serif",
      "serif",
      "system-ui",
      "cursive",
      "fantasy",
      "symmingliu",
    ].includes(lower)
  ) {
    return true;
  }

  if (typeof document !== "undefined" && document.fonts) {
    try {
      for (const fontFace of document.fonts) {
        const family = (fontFace.family || "")
          .trim()
          .replace(/^['"]|['"]$/g, "")
          .toLowerCase();
        if (family === lower) {
          return true;
        }
      }
    } catch (e) {
      // Ignore iteration errors if any
    }
  }

  let canvas = customCanvas;
  if (!canvas) {
    if (typeof document === "undefined" || !document.createElement) {
      return true;
    }
    canvas = document.createElement("canvas");
  }
  const ctx =
    canvas && typeof canvas.getContext === "function"
      ? canvas.getContext("2d")
      : null;
  if (!ctx) {
    return true;
  }

  const fallbacks = ["monospace", "sans-serif", "serif"];
  const testString = "mmmmmmmmmmlliWW10中文字體測試繁體";
  const fontSize = "72px";
  const escaped = trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  for (const fb of fallbacks) {
    ctx.font = `${fontSize} ${fb}`;
    const baseWidth = ctx.measureText(testString).width;
    ctx.font = `${fontSize} "${escaped}", ${fb}`;
    const testWidth = ctx.measureText(testString).width;
    if (testWidth !== baseWidth) {
      return true;
    }
  }

  return false;
}

/**
 * Filters an array of font names, returning only those available on the system.
 * Reuses a single canvas context for efficiency.
 *
 * @param {string[]} fontList - List of font names to filter
 * @param {HTMLCanvasElement} [customCanvas] - Optional canvas element for testing
 * @returns {string[]} Filtered array of available font names
 */
export function filterAvailableFonts(fontList, customCanvas) {
  if (!Array.isArray(fontList)) {
    return [];
  }
  let canvas = customCanvas;
  if (!canvas && typeof document !== "undefined" && document.createElement) {
    canvas = document.createElement("canvas");
  }
  return fontList.filter((f) => isFontAvailable(f, canvas));
}

const KNOWN_HALF_WIDTH_ASCII_FONTS = new Set([
  "symmingliu",
  "mingliu",
  "pmingliu",
  "dfkai-sb",
  "sarasa mono tc",
  "iosevka",
  "noto sans mono cjk tc",
]);

function getHeuristicAsciiWidthRatio(fontName) {
  const lower = (fontName || "").toLowerCase();
  if (
    lower === "courier" ||
    lower === "courier new" ||
    lower === "nimbus mono l" ||
    lower === "freemono" ||
    lower === "liberation mono" ||
    lower === "dejavu sans mono" ||
    lower === "menlo" ||
    lower === "monaco" ||
    lower === "sf mono" ||
    lower === "fira code" ||
    lower === "jetbrains mono" ||
    lower === "source code pro"
  ) {
    return 0.6;
  }
  if (
    lower === "consolas" ||
    lower === "cascadia code" ||
    lower === "cascadia mono" ||
    lower === "ubuntu mono"
  ) {
    return 0.55;
  }
  if (KNOWN_HALF_WIDTH_ASCII_FONTS.has(lower)) {
    return 0.5;
  }
  return null;
}

/**
 * Measures or estimates the advance width ratio (width / fontSize) of ASCII
 * characters for a given font-family stack.
 * In traditional CJK BBS fonts (MingLiu, SymMingLiu), ASCII width ratio is 0.5 (1 column = 0.5em).
 * In Western monospace fonts (Courier, Consolas, Menlo, Monaco), ASCII width ratio is ~0.55-0.6em.
 *
 * @param {string} fontFace - CSS font-family string
 * @param {HTMLCanvasElement} [customCanvas] - Optional canvas for testing
 * @returns {number} Advance width ratio in em (e.g. 0.5 for MingLiu, 0.6 for Courier)
 */
export function getAsciiWidthRatio(fontFace, customCanvas) {
  if (!fontFace || typeof fontFace !== "string") {
    return 0.5;
  }
  let canvas = customCanvas;
  if (!canvas && typeof document !== "undefined" && document.createElement) {
    canvas = document.createElement("canvas");
  }
  const ctx =
    canvas && typeof canvas.getContext === "function"
      ? canvas.getContext("2d")
      : null;

  const testSize = 100;

  if (customCanvas && ctx) {
    ctx.font = `${testSize}px ${fontFace}`;
    const widthM = ctx.measureText("MMMMMMMMMM").width / 10;
    const widthI = ctx.measureText("iiiiiiiiii").width / 10;
    if (widthM > 0) {
      if (Math.abs(widthM - widthI) <= testSize * 0.02) {
        return widthM / testSize;
      }
      return 0.5;
    }
  }

  const fonts = parseFontList(fontFace);
  for (const f of fonts) {
    if (
      typeof document !== "undefined" &&
      !customCanvas &&
      !isFontAvailable(f, canvas)
    ) {
      continue;
    }

    const lower = f.toLowerCase();
    if (KNOWN_HALF_WIDTH_ASCII_FONTS.has(lower)) {
      return 0.5;
    }

    if (ctx) {
      const escaped = f.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      ctx.font = `${testSize}px "${escaped}", monospace`;
      const widthM = ctx.measureText("MMMMMMMMMM").width / 10;
      const widthI = ctx.measureText("iiiiiiiiii").width / 10;
      if (widthM > 0) {
        if (Math.abs(widthM - widthI) <= testSize * 0.02) {
          return widthM / testSize;
        }
        return 0.5;
      }
    }

    const heuristic = getHeuristicAsciiWidthRatio(f);
    if (heuristic !== null) {
      return heuristic;
    }
  }

  return 0.5;
}

/**
 * Computes the CSS letter-spacing adjustment (in em) needed for ASCII characters
 * so that each ASCII character occupies exactly 0.5em (1 BBS column = chw).
 *
 * @param {string} fontFace - CSS font-family string
 * @param {HTMLCanvasElement} [customCanvas] - Optional canvas for testing
 * @returns {number} Letter-spacing offset in em (e.g. -0.1 for Courier, 0 for MingLiu)
 */
export function getAsciiLetterSpacingEm(fontFace, customCanvas) {
  const ratio = getAsciiWidthRatio(fontFace, customCanvas);
  if (ratio > 0.501) {
    return Number((0.5 - ratio).toFixed(4));
  }
  return 0;
}

/**
 * Wraps contiguous printable ASCII characters outside of HTML tags in
 * `<span class="term-ascii">...</span>` so that `--term-ascii-ls` letter-spacing
 * compensation applies to raw HTML prompt strings.
 *
 * @param {string} htmlStr - HTML string
 * @returns {string} HTML string with ASCII runs wrapped
 */
export function wrapAsciiHtml(htmlStr) {
  if (!htmlStr || typeof htmlStr !== "string") {
    return htmlStr;
  }
  return htmlStr.replace(
    /(<[^>]*>)|([\x20-\x3b\x3d\x3f-\x7e]+)/g,
    (match, tag, ascii) => {
      if (tag) return tag;
      return `<span class="term-ascii">${ascii}</span>`;
    }
  );
}



