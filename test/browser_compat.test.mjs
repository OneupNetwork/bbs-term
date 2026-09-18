import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  applyBrowserDeprecationFixes,
  createStorageQuotaShim,
} from '../src/js/browser_compat.js';

test('applyBrowserDeprecationFixes shims webkitPersistentStorage using standardized navigator.storage without invoking native getter', async () => {
  let nativeGetterCalled = false;
  let estimateCalled = false;
  let persistCalled = false;

  const mockNavProto = {};
  Object.defineProperty(mockNavProto, 'webkitPersistentStorage', {
    get() {
      nativeGetterCalled = true;
      return { deprecated: true };
    },
    configurable: true,
    enumerable: true,
  });

  const mockNav = Object.create(mockNavProto);
  mockNav.storage = {
    estimate: async () => {
      estimateCalled = true;
      return { usage: 1024, quota: 1048576 };
    },
    persist: async () => {
      persistCalled = true;
      return true;
    },
  };

  applyBrowserDeprecationFixes({}, mockNav);

  // Native getter must NOT be invoked during shim installation
  assert.equal(nativeGetterCalled, false);

  // Accessing webkitPersistentStorage returns standardized shim
  const storageQuota = mockNav.webkitPersistentStorage;
  assert.equal(nativeGetterCalled, false);
  assert.equal(typeof storageQuota.queryUsageAndQuota, 'function');
  assert.equal(typeof storageQuota.requestQuota, 'function');

  await new Promise((resolve, reject) => {
    storageQuota.queryUsageAndQuota((usage, quota) => {
      assert.equal(usage, 1024);
      assert.equal(quota, 1048576);
      resolve();
    }, reject);
  });
  assert.equal(estimateCalled, true);

  await new Promise((resolve, reject) => {
    storageQuota.requestQuota(
      2048,
      (granted) => {
        assert.equal(granted, 2048);
        resolve();
      },
      reject
    );
  });
  assert.equal(persistCalled, true);
});

test('applyBrowserDeprecationFixes neutralizes Protected Audience and Shared Storage APIs without invoking getters', () => {
  let fledgeGetterCalled = false;
  let sharedStorageGetterCalled = false;

  const mockNavProto = {};
  Object.defineProperty(mockNavProto, 'joinAdInterestGroup', {
    get() {
      fledgeGetterCalled = true;
      return () => {};
    },
    configurable: true,
  });
  Object.defineProperty(mockNavProto, 'runAdAuction', {
    get() {
      fledgeGetterCalled = true;
      return () => {};
    },
    configurable: true,
  });
  Object.defineProperty(mockNavProto, 'protectedAudience', {
    get() {
      fledgeGetterCalled = true;
      return {};
    },
    configurable: true,
  });

  const mockWinProto = {};
  Object.defineProperty(mockWinProto, 'sharedStorage', {
    get() {
      sharedStorageGetterCalled = true;
      return {};
    },
    configurable: true,
  });

  const mockNav = Object.create(mockNavProto);
  const mockWin = Object.create(mockWinProto);

  applyBrowserDeprecationFixes(mockWin, mockNav);

  assert.equal(fledgeGetterCalled, false);
  assert.equal(sharedStorageGetterCalled, false);

  assert.equal(mockNav.joinAdInterestGroup, undefined);
  assert.equal(mockNav.runAdAuction, undefined);
  assert.equal(mockNav.protectedAudience, undefined);
  assert.equal(mockWin.sharedStorage, undefined);

  assert.equal(fledgeGetterCalled, false);
  assert.equal(sharedStorageGetterCalled, false);
});

test('index.html has early inline deprecation guard and preserves clean #t terminal input attributes', () => {
  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.match(indexHtml, /webkitPersistentStorage/);
  assert.match(indexHtml, /sharedStorage/);
  assert.match(indexHtml, /joinAdInterestGroup/);
  assert.match(indexHtml, /<input id="t" type="text" autocomplete="off" inputmode="none" virtualkeyboardpolicy="manual" tabindex="-1"/);
});

test('all form controls in PrefModal and settings components have associated labels or aria-label', () => {
  const prefModalSrc = fs.readFileSync(
    path.resolve('src/components/Settings/PrefModal.js'),
    'utf8'
  );
  // Every <label className="control-label"> should have htmlFor
  const unlabeledControlLabels = prefModalSrc.match(
    /<label\s+className="control-label"\s*>/g
  );
  assert.equal(
    unlabeledControlLabels,
    null,
    'All control-label elements in PrefModal should specify htmlFor'
  );

  // Check FontManager input/select have aria-label
  const fontManagerSrc = fs.readFileSync(
    path.resolve('src/components/Settings/FontManager.js'),
    'utf8'
  );
  assert.match(fontManagerSrc, /<input[\s\S]*?aria-label=/);
  assert.match(fontManagerSrc, /<select[\s\S]*?aria-label=/);
});
