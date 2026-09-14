export const INITIAL_TRUSTED_IMAGE_DOMAINS = [
  "imgur.com",
  "imgtok.com",
  "meee.com.tw",
  "duk.tw",
  "upload.cc",
  "ibb.co",
  "imgbb.com",
  "postimg.cc",
  "twimg.com",
  "gyazo.com",
];

export const TRUSTED_IMAGE_DOMAINS = [...INITIAL_TRUSTED_IMAGE_DOMAINS];

export function normalizeDomain(raw) {
  if (!raw || typeof raw !== "string") return "";
  let s = raw.trim().toLowerCase();
  if (!s) return "";
  try {
    if (s.includes("://")) {
      const u = new URL(s);
      s = u.hostname.toLowerCase();
    } else {
      s = s.split("/")[0].split(":")[0].trim();
    }
  } catch (e) {
    s = s.split("/")[0].split(":")[0].trim();
  }
  return s.replace(/^\.+|\.+$/g, "");
}

export function parseTrustedDomains(raw) {
  if (raw === undefined || raw === null) {
    return [...TRUSTED_IMAGE_DOMAINS];
  }
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\s,]+/)
      : [];
  const result = [];
  const seen = new Set();
  for (const item of list) {
    const d = normalizeDomain(item);
    if (d && !seen.has(d)) {
      seen.add(d);
      result.push(d);
    }
  }
  return result;
}

export function mergeTrustedDomainsWithNewDefaults(
  savedDomains,
  savedKnownDefaults,
  currentDefaults = TRUSTED_IMAGE_DOMAINS,
) {
  const currentList = parseTrustedDomains(savedDomains);
  const knownDefaultsList =
    savedKnownDefaults !== undefined && savedKnownDefaults !== null
      ? parseTrustedDomains(savedKnownDefaults)
      : INITIAL_TRUSTED_IMAGE_DOMAINS;
  const knownSet = new Set(knownDefaultsList);
  const targetDefaults = parseTrustedDomains(currentDefaults);

  for (const domain of targetDefaults) {
    if (!knownSet.has(domain) && !currentList.includes(domain)) {
      currentList.push(domain);
    }
  }

  return currentList;
}

export function isTrustedImageDomain(
  hostname,
  trustedDomains = TRUSTED_IMAGE_DOMAINS,
) {
  if (!hostname) return false;
  const host = hostname.toLowerCase();
  const list = Array.isArray(trustedDomains)
    ? trustedDomains
    : parseTrustedDomains(trustedDomains);
  return list.some(
    (domain) => host === domain || host.endsWith("." + domain),
  );
}

export function resolveImageUrl(
  href,
  whitelistOnly = true,
  trustedDomains = TRUSTED_IMAGE_DOMAINS,
) {
  if (!href || typeof href !== "string") return null;

  let url;
  try {
    url = new URL(href);
  } catch (e) {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  const isTrusted = isTrustedImageDomain(hostname, trustedDomains);

  if (whitelistOnly && !isTrusted) {
    return null;
  }

  // 1. Imgur resolver (supports with or without extension)
  const imgurMatch = href.match(
    /^https?:\/\/(?:[im]\.)?imgur\.com\/(?:gallery\/|a\/)?([a-zA-Z0-9]+)(?:\.([a-zA-Z0-9]+))?(?:[?#].*)?$/i,
  );
  if (imgurMatch) {
    const photoId = imgurMatch[1];
    const ext = imgurMatch[2];
    if (ext && !/^(jpe?g|png|gif|webp|bmp)$/i.test(ext)) {
      return null;
    }
    return `https://i.imgur.com/${photoId}.${ext || "jpg"}`;
  }

  // 2. Twitter / X image CDN (pbs.twimg.com)
  if (hostname === "pbs.twimg.com" && url.pathname.startsWith("/media/")) {
    return href;
  }

  // 3. URLs with common image extensions (.jpg, .jpeg, .png, .gif, .webp, .bmp)
  const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp|bmp)(?:[?#].*)?$/i;
  if (IMAGE_EXT_REGEX.test(url.pathname + url.search)) {
    return href;
  }

  return null;
}

export function getImageRenderedSize(
  width,
  height,
  pageWidth = typeof window !== "undefined" ? window.innerWidth : 1024,
  pageHeight = typeof window !== "undefined" ? window.innerHeight : 768,
) {
  const safeW =
    typeof width === "number" && !isNaN(width) && width > 0 ? width : null;
  const safeH =
    typeof height === "number" && !isNaN(height) && height > 0 ? height : 0;

  const maxW = pageWidth * 0.9;
  const maxH = pageHeight * 0.8;

  if (safeW && safeH) {
    const scale = Math.min(1, maxW / safeW, maxH / safeH);
    return {
      width: safeW * scale,
      height: safeH * scale,
    };
  }

  return {
    width: maxW,
    height: Math.min(maxH, safeH),
  };
}

export function getTop(
  top,
  height,
  pageHeight = typeof window !== "undefined" ? window.innerHeight : 768,
) {
  const safeTop = typeof top === "number" && !isNaN(top) ? top : 20;
  const safeHeight = typeof height === "number" && !isNaN(height) ? height : 0;
  const clampedHeight = Math.min(pageHeight * 0.8, safeHeight);

  return Math.max(
    20,
    Math.min(pageHeight - 20 - clampedHeight, safeTop - clampedHeight / 2),
  );
}

export function getLeft(
  left,
  width,
  pageWidth = typeof window !== "undefined" ? window.innerWidth : 1024,
) {
  const safeLeft = typeof left === "number" && !isNaN(left) ? left : 20;
  const safeWidth = typeof width === "number" && !isNaN(width) ? width : 0;

  // Place 20px to the right of cursor by default.
  // If placing on the right would exceed the page margin, flip to the left of cursor.
  if (safeLeft + 20 + safeWidth > pageWidth - 20) {
    return Math.max(20, safeLeft - 20 - safeWidth);
  }
  return safeLeft + 20;
}

export function getPopupPosition(
  left,
  top,
  popupWidth = 200,
  popupHeight = 36,
  pageWidth = typeof window !== "undefined" ? window.innerWidth : 1024,
  pageHeight = typeof window !== "undefined" ? window.innerHeight : 768,
) {
  const safeLeft = typeof left === "number" && !isNaN(left) ? left : 20;
  const safeTop = typeof top === "number" && !isNaN(top) ? top : 20;

  let x = safeLeft + 20;
  if (x + popupWidth > pageWidth - 20) {
    x = Math.max(20, safeLeft - 20 - popupWidth);
  }

  let y = safeTop - popupHeight / 2;
  y = Math.max(20, Math.min(pageHeight - 20 - popupHeight, y));

  return { left: x, top: y };
}

export const initialImagePreviewState = {
  currentImagePreview: undefined,
  previewHref: undefined,
  left: undefined,
  top: undefined,
};

export const resetImagePreviewState = () => ({
  currentImagePreview: undefined,
  previewHref: undefined,
  left: undefined,
  top: undefined,
});

export const updateImagePreviewMove = (state, clientX, clientY) => {
  if (
    state &&
    state.currentImagePreview &&
    (state.left === undefined || state.top === undefined)
  ) {
    return { left: clientX, top: clientY };
  }
  return null;
};

let sharedImageObserver = null;
const observerCallbacks = new WeakMap();

export function getSharedImageObserver() {
  if (!sharedImageObserver && typeof IntersectionObserver !== "undefined") {
    sharedImageObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cb = observerCallbacks.get(entry.target);
            if (cb) {
              cb();
              observerCallbacks.delete(entry.target);
              sharedImageObserver.unobserve(entry.target);
            }
          }
        }
      },
      {
        rootMargin: "300px 0px",
      },
    );
  }
  return sharedImageObserver;
}

export function registerImageIntersection(element, callback) {
  if (!element) return () => {};
  const observer = getSharedImageObserver();
  if (!observer) {
    callback();
    return () => {};
  }
  observerCallbacks.set(element, callback);
  observer.observe(element);
  return () => {
    observerCallbacks.delete(element);
    observer.unobserve(element);
  };
}

export function resetSharedImageObserverForTest() {
  if (sharedImageObserver) {
    sharedImageObserver.disconnect();
    sharedImageObserver = null;
  }
}
