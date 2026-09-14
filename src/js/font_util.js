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


