import { PAGE_STATE } from './sites/index.js';

export const DOUBLE_BACK_EXIT_MS = 800;
export const RESTORE_SENTINEL_MS = 120;

export class BackNavigationController {
  constructor(app, options = {}) {
    this.app = app;
    this.win = options.win || (typeof window !== 'undefined' ? window : null);
    this.now = options.now || (() => Date.now());
    this.setTimeout =
      options.setTimeout ||
      (this.win && typeof this.win.setTimeout === 'function'
        ? this.win.setTimeout.bind(this.win)
        : setTimeout);

    this.guardSeq = 0;
    this.currentId = 0;
    this.armed = false;
    this.restoring = false;
    this.passThrough = false;
    this.lastBlockedTime = 0;
    this._attached = false;

    this._onActivation = () => this.onActivation();
    this._onPopState = (e) => this.onPopState(e);
    this._onNavigate = (e) => this.onNavigate(e);

    if (options.attachDOM !== false) {
      this.attach();
    }
  }

  isEnabled() {
    return Boolean(this.app?.enableBackNavigation ?? true);
  }

  canNavigateBack() {
    const app = this.app;
    if (!app || !this.isEnabled()) return false;
    if (!app.conn || !app.conn.isConnected) return false;
    if (app.modalShown || app.contextMenuShown) return false;

    if (app.inputInterceptors?.isActive?.()) {
      return true;
    }

    const pageState = app.site?.pageState;
    return (
      pageState === PAGE_STATE.MENU ||
      pageState === PAGE_STATE.LIST ||
      pageState === PAGE_STATE.READING ||
      pageState === PAGE_STATE.MAPLE_LIST
    );
  }

  canNavigateForward() {
    return this.canNavigateBack();
  }

  triggerBackNavigation() {
    if (!this.canNavigateBack()) return false;
    this.app.setNavCmd('doLeft');
    return true;
  }

  triggerForwardNavigation() {
    if (!this.canNavigateForward()) return false;
    this.app.setNavCmd('doRight');
    return true;
  }

  pushSentinel() {
    const w = this.win;
    if (!w || !w.history || typeof w.history.pushState !== 'function') {
      return false;
    }
    const centerState = { backNavGuardId: ++this.guardSeq };
    const forwardState = { backNavGuardId: ++this.guardSeq };
    try {
      w.history.pushState(centerState, '');
      this.currentId = centerState.backNavGuardId;
      if (typeof w.history.back === 'function') {
        w.history.pushState(forwardState, '');
        this.restoring = true;
        w.history.back();
      }
      return true;
    } catch {
      return false;
    }
  }

  restoreSentinel(direction = 'forward') {
    const w = this.win;
    const stepFn = direction === 'back' ? w?.history?.back : w?.history?.forward;
    const canTraverse =
      direction === 'back'
        ? true
        : w?.navigation
          ? Boolean(w.navigation.canGoForward)
          : true;
    if (!canTraverse || !w?.history || typeof stepFn !== 'function') {
      this.armed = this.pushSentinel();
      return;
    }
    this.restoring = true;
    this.armed = true;
    try {
      stepFn.call(w.history);
    } catch {
      this.restoring = false;
      this.armed = this.pushSentinel();
      return;
    }
    this.setTimeout(() => {
      const state = w.history && w.history.state;
      if (state && state.backNavGuardId === this.currentId) {
        return;
      }
      this.restoring = false;
      this.armed = this.pushSentinel();
    }, RESTORE_SENTINEL_MS);
  }

  onActivation() {
    if (!this.armed && this.isEnabled()) {
      this.armed = this.pushSentinel();
    }
  }

  onNavigate(e) {
    if (!e || e.navigationType !== 'traverse') return;
    const nav = this.win?.navigation;
    const from = nav && nav.currentEntry ? nav.currentEntry.index : null;
    const to = e.destination ? e.destination.index : null;
    if (typeof from === 'number' && typeof to === 'number' && to - from < -1) {
      this.passThrough = true;
    }
  }

  onPopState(e) {
    if (this.restoring) {
      this.restoring = false;
      const state = e && e.state;
      if (state && state.backNavGuardId) {
        this.currentId = state.backNavGuardId;
      }
      return;
    }

    const state = e && e.state;
    const targetId =
      state && typeof state.backNavGuardId === 'number' ? state.backNavGuardId : 0;

    if (targetId === this.currentId) {
      return;
    }

    const isForward = targetId > this.currentId;

    if (!this.armed) return;
    this.armed = false;

    if (!this.isEnabled()) return;

    if (this.passThrough) {
      this.passThrough = false;
      return;
    }

    if (isForward) {
      this.triggerForwardNavigation();
      this.lastBlockedTime = 0;
      this.restoreSentinel('back');
      return;
    }

    if (this.triggerBackNavigation()) {
      this.lastBlockedTime = 0;
      this.restoreSentinel('forward');
      return;
    }

    const t = this.now();
    if (this.lastBlockedTime && t - this.lastBlockedTime <= DOUBLE_BACK_EXIT_MS) {
      this.lastBlockedTime = 0;
      return;
    }

    this.lastBlockedTime = t;
    this.restoreSentinel('forward');
  }

  syncOverscrollStyle() {
    if (typeof document === 'undefined') return;
    const value = this.isEnabled() ? 'auto' : 'none';
    if (document.documentElement?.style) {
      document.documentElement.style.overscrollBehaviorX = value;
    }
    if (document.body?.style) {
      document.body.style.overscrollBehaviorX = value;
    }
  }

  attach() {
    if (this._attached || !this.win || typeof this.win.addEventListener !== 'function') {
      return;
    }
    this._attached = true;
    this.win.addEventListener('pointerdown', this._onActivation, true);
    this.win.addEventListener('keydown', this._onActivation, true);
    this.win.addEventListener('popstate', this._onPopState);
    if (this.win.navigation && typeof this.win.navigation.addEventListener === 'function') {
      this.win.navigation.addEventListener('navigate', this._onNavigate);
    }
    this.syncOverscrollStyle();
  }

  detach() {
    if (!this._attached || !this.win || typeof this.win.removeEventListener !== 'function') {
      return;
    }
    this._attached = false;
    this.win.removeEventListener('pointerdown', this._onActivation, true);
    this.win.removeEventListener('keydown', this._onActivation, true);
    this.win.removeEventListener('popstate', this._onPopState);
    if (this.win.navigation && typeof this.win.navigation.removeEventListener === 'function') {
      this.win.navigation.removeEventListener('navigate', this._onNavigate);
    }
    this.armed = false;
  }
}
