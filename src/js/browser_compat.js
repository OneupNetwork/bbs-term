const PROTECTED_AUDIENCE_PROPS = [
  'joinAdInterestGroup',
  'leaveAdInterestGroup',
  'updateAdInterestGroups',
  'clearOriginJoinedAdInterestGroups',
  'runAdAuction',
  'getInterestGroupAdAuctionData',
  'canLoadAdAuctionFencedFrame',
  'createAuctionNonce',
  'deprecatedURNToURL',
  'deprecatedReplaceInURN',
  'adAuctionComponents',
  'protectedAudience',
];

export function createStorageQuotaShim(nav) {
  const getStorage = () =>
    nav?.storage ||
    (typeof navigator !== 'undefined' ? navigator.storage : null);

  const queryUsageAndQuota = (successCallback, errorCallback) => {
    const storage = getStorage();
    if (storage && typeof storage.estimate === 'function') {
      storage.estimate().then(
        (estimate) => {
          if (typeof successCallback === 'function') {
            successCallback(estimate?.usage ?? 0, estimate?.quota ?? 0);
          }
        },
        (err) => {
          if (typeof errorCallback === 'function') {
            errorCallback(err);
          }
        }
      );
    } else if (typeof successCallback === 'function') {
      successCallback(0, 0);
    }
  };

  const requestQuota = (newQuotaInBytes, successCallback, errorCallback) => {
    const storage = getStorage();
    if (storage && typeof storage.persist === 'function') {
      storage.persist().then(
        () => {
          queryUsageAndQuota((usage, quota) => {
            if (typeof successCallback === 'function') {
              const granted = quota
                ? Math.min(newQuotaInBytes, quota)
                : newQuotaInBytes;
              successCallback(granted);
            }
          }, errorCallback);
        },
        (err) => {
          if (typeof errorCallback === 'function') {
            errorCallback(err);
          }
        }
      );
    } else if (typeof successCallback === 'function') {
      successCallback(newQuotaInBytes);
    }
  };

  return {
    queryUsageAndQuota,
    requestQuota,
  };
}

function neutralizeProperty(target, prop, replacementValue = undefined) {
  if (!target || (typeof target !== 'object' && typeof target !== 'function')) {
    return;
  }
  try {
    const desc = Object.getOwnPropertyDescriptor(target, prop);
    if (!desc) return;
    if (desc.configurable) {
      if (replacementValue === undefined) {
        delete target[prop];
        if (prop in target) {
          Object.defineProperty(target, prop, {
            value: undefined,
            configurable: true,
            writable: true,
            enumerable: false,
          });
        }
      } else {
        Object.defineProperty(target, prop, {
          get: () => replacementValue,
          configurable: true,
          enumerable: desc.enumerable ?? true,
        });
      }
    }
  } catch {
    // Ignore errors on non-configurable or sealed host objects
  }
}

export function applyBrowserDeprecationFixes(
  win = typeof window !== 'undefined' ? window : undefined,
  nav = typeof navigator !== 'undefined' ? navigator : undefined
) {
  if (!win && !nav) return;

  const navProto =
    (nav && Object.getPrototypeOf(nav)) ||
    (typeof Navigator !== 'undefined' ? Navigator.prototype : null);
  const winProto =
    (win && Object.getPrototypeOf(win)) ||
    (typeof Window !== 'undefined' ? Window.prototype : null);

  // 1. StorageType.persistent -> standardized navigator.storage shim
  // Avoid triggering Blink's kPersistentQuotaType getter deprecation warning
  const quotaShim = createStorageQuotaShim(nav);
  neutralizeProperty(navProto, 'webkitPersistentStorage', quotaShim);
  neutralizeProperty(nav, 'webkitPersistentStorage', quotaShim);

  const storageInfoShim = {
    TEMPORARY: 0,
    PERSISTENT: 1,
    queryUsageAndQuota(type, successCallback, errorCallback) {
      return quotaShim.queryUsageAndQuota(successCallback, errorCallback);
    },
    requestQuota(type, newQuotaInBytes, successCallback, errorCallback) {
      return quotaShim.requestQuota(
        newQuotaInBytes,
        successCallback,
        errorCallback
      );
    },
  };
  neutralizeProperty(winProto, 'webkitStorageInfo', storageInfoShim);
  neutralizeProperty(win, 'webkitStorageInfo', storageInfoShim);

  if (win && typeof win.webkitRequestFileSystem === 'function') {
    try {
      const origRequestFileSystem = win.webkitRequestFileSystem.bind(win);
      if (!origRequestFileSystem.__pttPatched) {
        const patched = function (type, size, successCallback, errorCallback) {
          // Redirect deprecated PERSISTENT (1) to TEMPORARY (0)
          const safeType = type === 1 ? 0 : type;
          return origRequestFileSystem(
            safeType,
            size,
            successCallback,
            errorCallback
          );
        };
        patched.__pttPatched = true;
        win.webkitRequestFileSystem = patched;
      }
    } catch {
      // Ignore if read-only
    }
  }

  // 2. Protected Audience API (kFledge) deprecation prevention
  for (const prop of PROTECTED_AUDIENCE_PROPS) {
    neutralizeProperty(navProto, prop, undefined);
    neutralizeProperty(nav, prop, undefined);
  }

  // 3. Shared Storage API (kSharedStorageAPIAll) deprecation prevention
  neutralizeProperty(winProto, 'sharedStorage', undefined);
  neutralizeProperty(win, 'sharedStorage', undefined);

  if (typeof HTMLIFrameElement !== 'undefined' && HTMLIFrameElement.prototype) {
    neutralizeProperty(
      HTMLIFrameElement.prototype,
      'sharedStorageWritable',
      undefined
    );
  }
  if (typeof HTMLImageElement !== 'undefined' && HTMLImageElement.prototype) {
    neutralizeProperty(
      HTMLImageElement.prototype,
      'sharedStorageWritable',
      undefined
    );
  }
}

applyBrowserDeprecationFixes();
