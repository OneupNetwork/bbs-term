import {
  TRUSTED_IMAGE_DOMAINS,
  parseTrustedDomains,
  mergeTrustedDomainsWithNewDefaults,
} from "../plugins/media_previewer/image_preview_util.js";

export const DEFAULT_PREFS = {
  enableMediaPreviewer: true,
  picPreviewWhitelistOnly: true,
  picPreviewTrustedDomains: [...TRUSTED_IMAGE_DOMAINS],
  picPreviewKnownDefaults: [...TRUSTED_IMAGE_DOMAINS],
  enableBell: "always",
  enableVisualBell: false,
  warnBeforeClose: true,
  enableEasyReading: false,
  enableLiveUpdate: false,
  endTurnsOnLiveUpdate: true,
  liveUpdateInterval: 3,
  showLiveUpdateToolbar: true,
  copyOnSelect: false,
  trimTrailingSpaces: true,
  rightClickAction: "menu",
  mouseWheelAction: "arrow-1",
  mouseWheelRightAction: "page",
  mouseWheelLeftAction: "none",
  mouseWheelTrackpadMode: false,
  mouseWheelChangePost: false,
  enableBackNavigation: true,
  supportMouseReporting: true,
  enableAntiIdle: false,
  antiIdleTime: 180,
  enableAutoWrap: true,
  lineWrap: 78,
  useCanvasEngine: true,
  enableFpsMeter: false,
  smoothAnsiArt: true,
  enablePacketDump: false,
  enableInputHelper: true,
  enableTouchDebugHUD: false,
  enableLoginAssist: true,
  enablePwaPrompt: false,
  enableVirtualKeyboard: false,

  // locale
  uiLocale: "auto",

  // keyboard
  backspaceKey: "control-h",
  deleteKey: "escape-sequence",

  // mouse browsing
  enableMouseBrowsing: false,
  mouseBrowsingHighlight: true,
  mouseBrowsingHighlightColor: 2,
  mouseLeftFunction: "none",
  mouseMiddleFunction: "none",

  // displays
  colorScheme: 'default',
  customDefaultBg: '#000000',
  customDefaultFg: '#c0c0c0',
  customDefaultLink: '#ff6600',
  customForcePlainText: false,
  minimumContrast: 0,
  customColors: [
    '#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0',
    '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'
  ],
  lineHeight: 1.0,
  cursorStyle: 'blink',
  fontFitWindowWidth: false,
  fontFace: "MingLiu,SymMingLiu,'Noto Sans Mono CJK TC','PingFang TC',monospace",
  fontSize: 24,
  fontSizePortrait: 16,
  termSize: { cols: 80, rows: 24 },
  termSizeMode: "fixed-term-size",
  termMargin: 0,
};

export const PREF_STORAGE_KEY = "pttchrome.pref.v1";

export const isMobileEnvironment = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const isIPadOS = platform === "MacIntel" && maxTouchPoints > 1 && !/Chrome\//.test(ua);
  return (
    /iPad|iPhone|iPod|Android|Mobile/i.test(ua) || isIPadOS
  );
};

export const isStandaloneMode = () => {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.navigator?.standalone === true ||
      (typeof window.matchMedia === "function" &&
        (window.matchMedia("(display-mode: standalone)").matches ||
          window.matchMedia("(display-mode: fullscreen)").matches ||
          window.matchMedia("(display-mode: window-controls-overlay)").matches))
  );
};

export const PLUGIN_PREF_KEY_MAP = {
  anti_idle: "enableAntiIdle",
  login_assist: "enableLoginAssist",
  auto_login: "enableLoginAssist",
  auto_wrap: "enableAutoWrap",
  easy_reading: "enableEasyReading",
  fps_meter: "enableFpsMeter",
  input_helper: "enableInputHelper",
  live_update: "enableLiveUpdate",
  media_previewer: "enableMediaPreviewer",
  mouse_browsing: "enableMouseBrowsing",
  packet_dump: "enablePacketDump",
  pwa_prompt: "enablePwaPrompt",
  touch_debug_hud: "enableTouchDebugHUD",
  virtual_keyboard: "enableVirtualKeyboard",
};

export const registerPluginPrefs = (pluginClasses = []) => {
  if (!Array.isArray(pluginClasses)) return;
  for (const PluginClass of pluginClasses) {
    if (!PluginClass) continue;
    const id = PluginClass.id || PluginClass.name;
    const prefKey = PluginClass.prefKey;
    if (id && prefKey) {
      PLUGIN_PREF_KEY_MAP[id] = prefKey;
    }
    const defaults =
      typeof PluginClass.getDefaultPrefs === "function"
        ? PluginClass.getDefaultPrefs()
        : PluginClass.defaultPrefs;
    if (defaults && typeof defaults === "object") {
      Object.assign(DEFAULT_PREFS, defaults);
    }
  }
};

const resolvePluginPrefKey = (key) => {
  if (!key) return null;
  const trimmed = String(key).trim();
  if (Object.prototype.hasOwnProperty.call(PLUGIN_PREF_KEY_MAP, trimmed)) {
    return PLUGIN_PREF_KEY_MAP[trimmed];
  }
  if (trimmed === "enableAutoLogin") {
    return "enableLoginAssist";
  }
  if (Object.values(PLUGIN_PREF_KEY_MAP).includes(trimmed)) {
    return trimmed;
  }
  return null;
};

export const parseDefaultPlugins = (
  raw = typeof process !== "undefined" && process.env ? process.env.DEFAULT_PLUGINS : ""
) => {
  if (!raw) return {};
  const result = {};

  let parsedObj = null;
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    parsedObj = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    if (trimmed.startsWith("{")) {
      try {
        parsedObj = JSON.parse(trimmed);
      } catch {
        return {};
      }
    } else {
      const items = trimmed.split(",");
      for (const item of items) {
        const s = item.trim();
        if (!s) continue;
        let enabled = true;
        let name = s;
        if (s.startsWith("+")) {
          name = s.slice(1).trim();
          enabled = true;
        } else if (s.startsWith("-") || s.startsWith("!")) {
          name = s.slice(1).trim();
          enabled = false;
        }
        const prefKey = resolvePluginPrefKey(name);
        if (prefKey) {
          result[prefKey] = enabled;
        }
      }
      return result;
    }
  }

  if (parsedObj && typeof parsedObj === "object") {
    for (const [k, v] of Object.entries(parsedObj)) {
      const prefKey = resolvePluginPrefKey(k);
      if (prefKey) {
        if (typeof v === "boolean") {
          result[prefKey] = v;
        } else if (typeof v === "string") {
          const lower = v.toLowerCase();
          if (lower === "true" || lower === "1" || lower === "yes" || lower === "on") {
            result[prefKey] = true;
          } else if (lower === "false" || lower === "0" || lower === "no" || lower === "off") {
            result[prefKey] = false;
          }
        } else if (typeof v === "number") {
          result[prefKey] = Boolean(v);
        }
      }
    }
  }

  return result;
};

export const parseDefaultPrefs = (
  raw = typeof process !== "undefined" && process.env ? process.env.DEFAULT_PREFS : ""
) => {
  if (!raw) return {};
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return { ...raw };
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }
  return {};
};

export const calcFittingFontSize = (width, height) => {
  if (!width || !height || width <= 0 || height <= 0) {
    return DEFAULT_PREFS.fontSize;
  }
  const margin = width <= 768 ? 0 : 10;
  const availWidth = Math.max(0, width - margin);
  const fitWidth = Math.floor(availWidth / 40);
  const fitHeight = Math.floor(height / 24);
  const fitted = Math.min(fitWidth, fitHeight);
  return Math.max(8, Math.min(24, fitted));
};

export const getDefaultFontSize = (isPortrait = undefined) => {
  if (typeof window === "undefined") {
    return isPortrait === true ? DEFAULT_PREFS.fontSizePortrait : DEFAULT_PREFS.fontSize;
  }
  const width = window.innerWidth || window.screen?.width || 0;
  const height = window.innerHeight || window.screen?.height || 0;
  if (width <= 0 || height <= 0) {
    if (isPortrait === true) {
      return isMobileEnvironment() ? 9 : DEFAULT_PREFS.fontSizePortrait;
    }
    return isMobileEnvironment() ? 16 : DEFAULT_PREFS.fontSize;
  }
  if (isPortrait === true) {
    return calcFittingFontSize(Math.min(width, height), Math.max(width, height));
  }
  if (isPortrait === false) {
    return calcFittingFontSize(Math.max(width, height), Math.min(width, height));
  }
  return calcFittingFontSize(width, height);
};

export const getDefaultPwaPrompt = () => {
  if (isStandaloneMode()) return false;
  return isMobileEnvironment();
};

export const getDefaultVirtualKeyboard = () => {
  return isMobileEnvironment();
};

export const getDefaultPrefs = () => {
  const customDefaults = parseDefaultPrefs();
  if (
    customDefaults.enableLoginAssist === undefined &&
    customDefaults.enableAutoLogin !== undefined
  ) {
    customDefaults.enableLoginAssist = Boolean(customDefaults.enableAutoLogin);
  }
  if (customDefaults.termSizeMode === "max-font-size") {
    customDefaults.termSizeMode = DEFAULT_PREFS.termSizeMode;
  }
  delete customDefaults.maxFontSize;
  return {
    ...DEFAULT_PREFS,
    fontSize: getDefaultFontSize(false),
    fontSizePortrait: getDefaultFontSize(true),
    enablePwaPrompt: getDefaultPwaPrompt(),
    enableVirtualKeyboard: getDefaultVirtualKeyboard(),
    ...parseDefaultPlugins(),
    ...customDefaults,
    termSize: {
      ...DEFAULT_PREFS.termSize,
      ...(customDefaults.termSize && typeof customDefaults.termSize === "object"
        ? customDefaults.termSize
        : {}),
    },
    customColors:
      Array.isArray(customDefaults.customColors) &&
      customDefaults.customColors.length === 16
        ? [...customDefaults.customColors]
        : [...DEFAULT_PREFS.customColors],
    customDefaultBg:
      customDefaults.customDefaultBg ?? DEFAULT_PREFS.customDefaultBg,
    customDefaultFg:
      customDefaults.customDefaultFg ?? DEFAULT_PREFS.customDefaultFg,
    customDefaultLink:
      customDefaults.customDefaultLink ?? DEFAULT_PREFS.customDefaultLink,
    customForcePlainText:
      customDefaults.customForcePlainText ?? DEFAULT_PREFS.customForcePlainText,
    minimumContrast:
      customDefaults.minimumContrast ?? DEFAULT_PREFS.minimumContrast,
    picPreviewTrustedDomains:
      customDefaults.picPreviewTrustedDomains !== undefined
        ? parseTrustedDomains(customDefaults.picPreviewTrustedDomains)
        : [...DEFAULT_PREFS.picPreviewTrustedDomains],
    picPreviewKnownDefaults: [...DEFAULT_PREFS.picPreviewKnownDefaults],
    liveUpdateInterval: Math.max(
      3,
      parseInt(customDefaults.liveUpdateInterval, 10) || DEFAULT_PREFS.liveUpdateInterval
    ),
  };
};

export const readValuesWithDefault = () => {
  try {
    const raw =
      typeof window !== "undefined" && window.localStorage
        ? window.localStorage.getItem(PREF_STORAGE_KEY)
        : null;
    const saved = raw ? JSON.parse(raw).values : null;
    const prefs = {
      ...getDefaultPrefs(),
      ...saved,
      termSize: {
        ...DEFAULT_PREFS.termSize,
        ...(saved && saved.termSize),
      },
    };
    if (saved && saved.picPreviewTrustedDomains !== undefined) {
      prefs.picPreviewTrustedDomains = mergeTrustedDomainsWithNewDefaults(
        saved.picPreviewTrustedDomains,
        saved.picPreviewKnownDefaults,
        TRUSTED_IMAGE_DOMAINS
      );
      prefs.picPreviewKnownDefaults = [...TRUSTED_IMAGE_DOMAINS];
    }
    if (saved && Array.isArray(saved.customColors) && saved.customColors.length === 16) {
      prefs.customColors = [...saved.customColors];
    }
    if (saved && typeof saved.customDefaultBg === 'string' && /^#[0-9a-fA-F]{6}$/.test(saved.customDefaultBg)) {
      prefs.customDefaultBg = saved.customDefaultBg;
    }
    if (saved && typeof saved.customDefaultFg === 'string' && /^#[0-9a-fA-F]{6}$/.test(saved.customDefaultFg)) {
      prefs.customDefaultFg = saved.customDefaultFg;
    }
    if (saved && typeof saved.customDefaultLink === 'string' && /^#[0-9a-fA-F]{6}$/.test(saved.customDefaultLink)) {
      prefs.customDefaultLink = saved.customDefaultLink;
    }
    if (saved && typeof saved.customForcePlainText === 'boolean') {
      prefs.customForcePlainText = saved.customForcePlainText;
    }
    if (saved && typeof saved.minimumContrast === 'number') {
      prefs.minimumContrast = Math.max(0, Math.min(100, Math.round(saved.minimumContrast)));
    }
    if (isStandaloneMode()) {
      prefs.enablePwaPrompt = false;
    }
    if (saved) {
      if (saved.enableMouseBrowsing === undefined && saved.useMouseBrowsing !== undefined) {
        prefs.enableMouseBrowsing = Boolean(saved.useMouseBrowsing);
      }
      if (saved.enableMediaPreviewer === undefined && saved.enablePicPreview !== undefined) {
        prefs.enableMediaPreviewer = Boolean(saved.enablePicPreview);
      }
      if (saved.enableLoginAssist === undefined && saved.enableAutoLogin !== undefined) {
        prefs.enableLoginAssist = Boolean(saved.enableAutoLogin);
      }
      if (saved.liveUpdateInterval !== undefined) {
        const parsedInterval = parseInt(saved.liveUpdateInterval, 10);
        prefs.liveUpdateInterval = parsedInterval >= 3 ? parsedInterval : 3;
      }
      if (saved.showLiveUpdateToolbar !== undefined) {
        prefs.showLiveUpdateToolbar = Boolean(saved.showLiveUpdateToolbar);
      }
      if (saved.termSizeMode === "max-font-size") {
        prefs.termSizeMode = DEFAULT_PREFS.termSizeMode;
      }
      if (prefs.fontSize === 999 || prefs.fontSize === undefined) {
        prefs.fontSize = getDefaultFontSize(false);
      }
      if (prefs.fontSizePortrait === 999 || saved.fontSizePortrait === undefined) {
        prefs.fontSizePortrait = getDefaultFontSize(true);
        const defaultLandscape = getDefaultFontSize(false);
        if (saved.fontSize === 24 && defaultLandscape < 24) {
          prefs.fontSize = defaultLandscape;
        }
      }
      delete prefs.maxFontSize;
      if (saved.lineHeight !== undefined) {
        const parsedLineHeight = parseFloat(saved.lineHeight);
        prefs.lineHeight = !isNaN(parsedLineHeight) && parsedLineHeight > 0 ? parsedLineHeight : 1.0;
      }
      if (saved.uiLocale !== undefined) {
        prefs.uiLocale = saved.uiLocale;
      }
      const migrateLegacyWheel = (val) => {
        if (val === 0 || val === "0") return "none";
        if (val === 1 || val === "1") return "arrow-1";
        if (val === 2 || val === "2") return "page";
        if (val === 3 || val === "3") return "none";
        return undefined;
      };
      if (saved.mouseWheelAction === undefined && saved.mouseWheelFunction1 !== undefined) {
        const mapped = migrateLegacyWheel(saved.mouseWheelFunction1);
        if (mapped) prefs.mouseWheelAction = mapped;
      }
      if (saved.mouseWheelRightAction === undefined && saved.mouseWheelFunction2 !== undefined) {
        const mapped = migrateLegacyWheel(saved.mouseWheelFunction2);
        if (mapped) prefs.mouseWheelRightAction = mapped;
      }
      if (saved.mouseWheelLeftAction === undefined && saved.mouseWheelFunction3 !== undefined) {
        const mapped = migrateLegacyWheel(saved.mouseWheelFunction3);
        if (mapped) prefs.mouseWheelLeftAction = mapped;
      }
      delete prefs.mouseWheelFunction1;
      delete prefs.mouseWheelFunction2;
      delete prefs.mouseWheelFunction3;
    }
    prefs.mouseLeftFunction = normalizeMouseButtonAction(
      prefs.mouseLeftFunction,
      "left"
    );
    prefs.mouseMiddleFunction = normalizeMouseButtonAction(
      prefs.mouseMiddleFunction,
      "middle"
    );
    prefs.rightClickAction = normalizeMouseButtonAction(
      prefs.rightClickAction,
      "right"
    );
    return prefs;
  } catch (e) {
    return getDefaultPrefs();
  }
};

export const MOUSE_NAV_KEYS = [
  "enter",
  "left",
  "right",
  "up",
  "down",
  "pageup",
  "pagedown",
  "esc",
];

export const normalizeMouseButtonAction = (val, buttonType = "left") => {
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed !== "") {
      const num = Number(trimmed);
      if (!Number.isNaN(num)) {
        val = num;
      } else {
        return trimmed;
      }
    }
  }
  if (typeof val === "boolean") {
    return val ? "enter" : "none";
  }
  if (typeof val === "number") {
    if (buttonType === "middle") {
      switch (val) {
        case 1:
          return "enter";
        case 2:
          return "left";
        case 3:
          return "paste";
        default:
          return "none";
      }
    } else {
      switch (val) {
        case 1:
          return "enter";
        case 2:
          return "right";
        default:
          return "none";
      }
    }
  }
  return buttonType === "right" ? "menu" : "none";
};

export const writeValues = (values) => {
  if (values && values.picPreviewTrustedDomains !== undefined) {
    values.picPreviewKnownDefaults = [...TRUSTED_IMAGE_DOMAINS];
  }
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(
        PREF_STORAGE_KEY,
        JSON.stringify({
          values,
        })
      );
    }
  } catch (e) {}
  return values;
};

export const updatePrefs = (patch) => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(PREF_STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) : { values: {} };
      if (!obj.values) {
        obj.values = {};
      }
      const nextPatch = { ...patch };
      if (nextPatch.enableAutoLogin !== undefined && nextPatch.enableLoginAssist === undefined) {
        nextPatch.enableLoginAssist = Boolean(nextPatch.enableAutoLogin);
      }
      if (nextPatch.picPreviewTrustedDomains !== undefined) {
        nextPatch.picPreviewKnownDefaults = [...TRUSTED_IMAGE_DOMAINS];
      }
      Object.assign(obj.values, nextPatch);
      if (nextPatch.enableLoginAssist !== undefined && "enableAutoLogin" in obj.values) {
        delete obj.values.enableAutoLogin;
      }
      window.localStorage.setItem(PREF_STORAGE_KEY, JSON.stringify(obj));
      return obj.values;
    }
  } catch (e) {}
  return null;
};

export const updatePref = (key, value) => {
  return updatePrefs({ [key]: value });
};

export const CARET_SHAPES = {
  IBEAM: "ibeam",
  BLOCK: "block",
  HALF_BLOCK: "half-block",
  UNDERLINE: "underline",
};

/**
 * Parse a cursorStyle preference string into shape and blink boolean.
 * Backward compatible with legacy strings: 'blink', 'underline', 'reverse', 'blink-reverse'.
 * @param {string} style
 * @returns {{ shape: string, blink: boolean }}
 */
export function parseCaretStyle(style) {
  if (!style) {
    return { shape: CARET_SHAPES.UNDERLINE, blink: true };
  }
  const s = String(style).toLowerCase();
  const blink = s === "blink" || s.startsWith("blink-") || s.endsWith("-blink");
  let shape = CARET_SHAPES.UNDERLINE;
  if (s.includes("ibeam") || s.includes("i-beam") || s.includes("bar")) {
    shape = CARET_SHAPES.IBEAM;
  } else if (
    s.includes("half-block") ||
    s.includes("reverse") ||
    s.includes("half")
  ) {
    shape = CARET_SHAPES.HALF_BLOCK;
  } else if (s.includes("block")) {
    shape = CARET_SHAPES.BLOCK;
  } else if (s.includes("underline") || s === "blink") {
    shape = CARET_SHAPES.UNDERLINE;
  }
  return { shape, blink };
}

/**
 * Serialize caret shape and blink boolean into a single cursorStyle string.
 * @param {string} shape
 * @param {boolean} blink
 * @returns {string}
 */
export function serializeCaretStyle(shape, blink) {
  if (blink) {
    if (shape === CARET_SHAPES.UNDERLINE) return "blink";
    if (shape === CARET_SHAPES.HALF_BLOCK) return "blink-reverse";
    return `blink-${shape}`;
  }
  if (shape === CARET_SHAPES.HALF_BLOCK) return "reverse";
  return shape;
}

/**
 * Parse an option label and extract any parenthesized note/description.
 * Supports both ASCII () and fullwidth （） parentheses, including nested parentheses.
 * @param {string} text
 * @returns {{ label: string, desc: string }}
 */
export function parseOptionText(text) {
  if (typeof text !== "string") {
    return { label: text, desc: "" };
  }
  const trimmed = text.trim();
  const lastChar = trimmed[trimmed.length - 1];
  if (lastChar === ")" || lastChar === "）") {
    let depth = 0;
    for (let i = trimmed.length - 1; i >= 0; i--) {
      const ch = trimmed[i];
      if (ch === ")" || ch === "）") {
        depth++;
      } else if (ch === "(" || ch === "（") {
        depth--;
        if (depth === 0) {
          const label = trimmed.slice(0, i).trim();
          const desc = trimmed.slice(i + 1, trimmed.length - 1).trim();
          if (label) {
            return { label, desc };
          }
          break;
        }
      }
    }
  }
  return { label: trimmed, desc: "" };
}

