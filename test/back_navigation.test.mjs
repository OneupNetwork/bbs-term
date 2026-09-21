import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BackNavigationController,
  DOUBLE_BACK_EXIT_MS,
} from '../src/js/back_navigation.js';
import {
  MouseController,
  isHorizontalWheelEvent,
} from '../src/js/mouse_controller.js';
import { PAGE_STATE } from '../src/js/sites/index.js';

function createMockWindow() {
  const listeners = new Map();
  const stack = [{ state: null }];
  let index = 0;

  const win = {
    history: {
      get state() {
        return stack[index]?.state ?? null;
      },
      pushState(state) {
        stack.splice(index + 1);
        stack.push({ state });
        index = stack.length - 1;
      },
      forward() {
        if (index + 1 < stack.length) {
          index++;
          const handlers = listeners.get('popstate') || [];
          for (const fn of handlers) {
            fn({ state: stack[index].state });
          }
        }
      },
      back() {
        if (index > 0) {
          index--;
          const handlers = listeners.get('popstate') || [];
          for (const fn of handlers) {
            fn({ state: stack[index].state });
          }
        }
      },
    },
    navigation: {
      get canGoForward() {
        return index + 1 < stack.length;
      },
      currentEntry: {
        get index() {
          return index;
        },
      },
      addEventListener() {},
      removeEventListener() {},
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      if (!listeners.has(type)) return;
      const arr = listeners.get(type).filter((f) => f !== fn);
      listeners.set(type, arr);
    },
    emit(type, event = {}) {
      const handlers = listeners.get(type) || [];
      for (const fn of handlers) {
        fn(event);
      }
    },
    getStackLength() {
      return stack.length;
    },
    getCurrentIndex() {
      return index;
    },
  };
  return win;
}

test('isHorizontalWheelEvent identifies horizontal-dominant wheel gestures', () => {
  assert.equal(isHorizontalWheelEvent(null), false);
  assert.equal(isHorizontalWheelEvent({ deltaX: 0, deltaY: 0 }), false);
  assert.equal(isHorizontalWheelEvent({ deltaX: 0, deltaY: -50 }), false);
  assert.equal(isHorizontalWheelEvent({ deltaX: -60, deltaY: 0 }), true);
  assert.equal(isHorizontalWheelEvent({ deltaX: -60, deltaY: 10 }), true);
  assert.equal(isHorizontalWheelEvent({ deltaX: 10, deltaY: -60 }), false);
});

test('MouseController ignores horizontal-dominant wheel events without preventing default', () => {
  const navCmds = [];
  let defaultPrevented = false;
  const mockApp = {
    modalShown: false,
    mouseWheelAction: 'page',
    isDialogOrExcludedTarget: () => false,
    setNavCmd: (cmd) => navCmds.push(cmd),
    buf: { locator: { isActive: () => false } },
    inputInterceptors: { dispatchWheel: () => false },
  };

  const controller = new MouseController(mockApp, { attachDOM: false });

  // Horizontal swipe should not send page down or preventDefault
  controller.onWheel({
    deltaX: -80,
    deltaY: 5,
    deltaMode: 0,
    buttons: 0,
    preventDefault() {
      defaultPrevented = true;
    },
    stopPropagation() {},
  });
  assert.deepEqual(navCmds, []);
  assert.equal(defaultPrevented, false);

  // Vertical scroll should send page down and preventDefault
  controller.onWheel({
    deltaX: 2,
    deltaY: 100,
    deltaMode: 0,
    buttons: 0,
    preventDefault() {
      defaultPrevented = true;
    },
    stopPropagation() {},
  });
  assert.deepEqual(navCmds, ['doPageDown']);
  assert.equal(defaultPrevented, true);
});

test('BackNavigationController intercepts browser back as doLeft and forward as doRight via center sentinel', () => {
  const navCmds = [];
  let currentTime = 1000;
  const mockWin = createMockWindow();

  const mockApp = {
    enableBackNavigation: true,
    modalShown: false,
    contextMenuShown: false,
    conn: { isConnected: true },
    site: { pageState: PAGE_STATE.READING },
    inputInterceptors: { isActive: () => false },
    setNavCmd: (cmd) => navCmds.push(cmd),
  };

  const backNav = new BackNavigationController(mockApp, {
    win: mockWin,
    now: () => currentTime,
    setTimeout: (fn) => fn(),
  });

  // 1. Before user activation, sentinel is not armed
  assert.equal(backNav.armed, false);
  assert.equal(mockWin.getStackLength(), 1);

  // 2. First user activation pushes center sentinel S1 + forward sentinel S2 and steps back to S1
  mockWin.emit('pointerdown');
  assert.equal(backNav.armed, true);
  assert.equal(mockWin.getStackLength(), 3);
  assert.equal(mockWin.getCurrentIndex(), 1);

  // 3. Consecutive back navigations send doLeft and traverse forward back to S1 without growing stack
  for (let i = 0; i < 5; i++) {
    mockWin.history.back();
    assert.equal(navCmds.length, i + 1);
    assert.equal(navCmds[i], 'doLeft');
    assert.equal(backNav.armed, true);
    assert.equal(mockWin.getStackLength(), 3);
    assert.equal(mockWin.getCurrentIndex(), 1);
  }

  // 4. Consecutive forward navigations send doRight and traverse back to S1 without growing stack
  for (let i = 0; i < 3; i++) {
    mockWin.history.forward();
    assert.equal(navCmds.length, 5 + i + 1);
    assert.equal(navCmds[5 + i], 'doRight');
    assert.equal(backNav.armed, true);
    assert.equal(mockWin.getStackLength(), 3);
    assert.equal(mockWin.getCurrentIndex(), 1);
  }

  // 5. When in NORMAL state (cannot navigate back), first back re-arms, second back within DOUBLE_BACK_EXIT_MS releases sentinel
  mockApp.site.pageState = PAGE_STATE.NORMAL;
  currentTime = 5000;
  mockWin.history.back();
  assert.equal(navCmds.length, 8); // no new doLeft sent
  assert.equal(backNav.armed, true); // still armed after first blocked attempt

  currentTime = 5000 + DOUBLE_BACK_EXIT_MS - 100;
  mockWin.history.back();
  assert.equal(navCmds.length, 8);
  assert.equal(backNav.armed, false); // released so next back leaves site

  backNav.detach();
});

test('main.css splits overscroll-behavior into x and y axes to allow horizontal native swipe', () => {
  const mainCss = fs.readFileSync(path.resolve('src/css/main.css'), 'utf-8');
  assert.ok(
    mainCss.includes('overscroll-behavior-y: none;') &&
      mainCss.includes('overscroll-behavior-x: auto;'),
    'html, body must set overscroll-behavior-y: none and overscroll-behavior-x: auto'
  );
  assert.ok(
    mainCss.includes('overscroll-behavior-y: contain;'),
    '#easyReadingContent must set overscroll-behavior-y: contain'
  );
});
