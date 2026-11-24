// Calm, low-stimulation W3C Gamepad API support for Pinto's World (Xbox, Steam Deck / SteamOS, DualSense, Switch Pro).
// Standard mapping: A=0, B=1, X=2, Y=3, LB=4, RB=5, Back=8, Start=9, DPad Up=12, Down=13, Left=14, Right=15.

const DEADZONE = 0.22;
const REPEAT_INITIAL_MS = 380;
const REPEAT_RATE_MS = 190;

function shapeAxis(v) {
  const a = Math.abs(v || 0);
  if (a <= DEADZONE) return 0;
  const norm = (a - DEADZONE) / (1 - DEADZONE);
  return Math.sign(v) * Math.pow(Math.min(1, norm), 1.35);
}

function isVisibleFocusable(el) {
  if (!el || el.disabled || el.hidden) return false;
  if (el.closest('[hidden], [aria-hidden="true"]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function focusablesIn(container) {
  if (!container) return [];
  return [...container.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')]
    .filter(isVisibleFocusable);
}

export function initGamepad(hooks) {
  const state = {
    connected: false,
    padName: '',
    lx: 0,
    ly: 0,
    rx: 0,
    ry: 0,
    dpadX: 0,
    dpadY: 0,
  };

  let prevBtns = [];
  let navDir = null;
  let navNextAt = 0;
  let rafId = 0;
  let polling = false;
  let gpFocused = null;

  function setGpFocus(el) {
    if (gpFocused && gpFocused !== el) gpFocused.classList.remove('is-gp-focus');
    gpFocused = el || null;
    if (gpFocused) {
      gpFocused.classList.add('is-gp-focus');
      try { gpFocused.focus({ preventScroll: false }); } catch {}
      try { gpFocused.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); } catch {}
    }
  }

  function activeContainer() {
    const dlg = document.querySelector('dialog[open]');
    if (dlg) return dlg;
    const view = document.querySelector('.view.is-active');
    return view || document.body;
  }

  function moveFocus(dx, dy) {
    const scope = activeContainer();
    const list = focusablesIn(scope);
    if (!list.length) return;
    const cur = list.includes(document.activeElement) ? document.activeElement : (list.includes(gpFocused) ? gpFocused : null);
    if (!cur) {
      setGpFocus(list[0]);
      return;
    }
    const cr = cur.getBoundingClientRect();
    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;
      const vx = ex - cx;
      const vy = ey - cy;
      const proj = vx * dx + vy * dy;
      if (proj <= 6) continue;
      const perp = Math.abs(vx * dy - vy * dx);
      const score = proj + perp * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) {
      setGpFocus(best);
    } else {
      const idx = list.indexOf(cur);
      const step = (dx > 0 || dy > 0) ? 1 : -1;
      setGpFocus(list[(idx + step + list.length) % list.length]);
    }
  }

  function clickFocused() {
    const scope = activeContainer();
    const list = focusablesIn(scope);
    if (!list.length) return false;
    const cur = list.includes(document.activeElement) ? document.activeElement : (list.includes(gpFocused) ? gpFocused : list[0]);
    if (!cur) return false;
    setGpFocus(cur);
    cur.click();
    return true;
  }

  function findActivePad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) return pads[i];
    }
    return null;
  }

  function setConnected(connected, name = '') {
    if (state.connected === connected && state.padName === name) return;
    state.connected = connected;
    state.padName = name;
    document.body.classList.toggle('has-gamepad', connected);
    if (!connected) {
      state.lx = state.ly = state.rx = state.ry = state.dpadX = state.dpadY = 0;
      prevBtns = [];
      setGpFocus(null);
    }
    hooks.onConnectionChange?.(connected, name);
  }

  function pressed(pad, idx) {
    const b = pad.buttons?.[idx];
    return Boolean(b && (b.pressed || b.value > 0.5));
  }

  function justPressed(pad, idx) {
    return pressed(pad, idx) && !prevBtns[idx];
  }

  function poll(now) {
    rafId = 0;
    if (!polling) return;
    const pad = findActivePad();
    if (!pad) {
      setConnected(false, '');
      polling = false;
      return;
    }
    setConnected(true, pad.id || 'Controller');

    state.lx = shapeAxis(pad.axes?.[0]);
    state.ly = shapeAxis(pad.axes?.[1]);
    state.rx = shapeAxis(pad.axes?.[2]);
    state.ry = shapeAxis(pad.axes?.[3]);

    const up = pressed(pad, 12);
    const down = pressed(pad, 13);
    const left = pressed(pad, 14);
    const right = pressed(pad, 15);
    state.dpadX = (right ? 1 : 0) - (left ? 1 : 0);
    state.dpadY = (down ? 1 : 0) - (up ? 1 : 0);

    const inDirect3D = Boolean(hooks.isDirect3DControl?.());
    const dlgOpen = Boolean(document.querySelector('dialog[open]'));

    // Edge-triggered actions
    if (justPressed(pad, 4)) hooks.onPrevTab?.();
    if (justPressed(pad, 5)) hooks.onNextTab?.();
    if (justPressed(pad, 2)) hooks.onRead?.();
    if (justPressed(pad, 1)) hooks.onCancel?.();
    if (justPressed(pad, 3)) hooks.onAction?.();
    if (justPressed(pad, 9)) hooks.onMenu?.();

    if (justPressed(pad, 0)) {
      const handled = hooks.onConfirm?.();
      if (!handled) clickFocused();
    }

    // Menu / dialog / diary directional navigation (when not steering Pinto or exploring 3D)
    if (!inDirect3D || dlgOpen) {
      const nx = state.dpadX || (Math.abs(state.lx) > 0.55 ? Math.sign(state.lx) : 0);
      const ny = state.dpadY || (Math.abs(state.ly) > 0.55 ? Math.sign(state.ly) : 0);
      const dirKey = nx || ny ? `${nx},${ny}` : null;
      if (!dirKey) {
        navDir = null;
      } else if (dirKey !== navDir || now >= navNextAt) {
        const isNew = dirKey !== navDir;
        navDir = dirKey;
        navNextAt = now + (isNew ? REPEAT_INITIAL_MS : REPEAT_RATE_MS);
        const handledDir = hooks.onNavigate?.(nx, ny);
        if (!handledDir) moveFocus(nx, ny);
      }
    } else {
      navDir = null;
      if (Math.abs(state.lx) > 0.01 || Math.abs(state.ly) > 0.01 || Math.abs(state.rx) > 0.01 || Math.abs(state.ry) > 0.01 || state.dpadX || state.dpadY) {
        hooks.on3DInput?.();
      }
    }

    prevBtns = (pad.buttons || []).map((b) => Boolean(b && (b.pressed || b.value > 0.5)));
    rafId = requestAnimationFrame(poll);
  }

  function startPolling() {
    if (polling) return;
    polling = true;
    rafId = requestAnimationFrame(poll);
  }

  window.addEventListener('gamepadconnected', (e) => {
    setConnected(true, e.gamepad?.id || 'Controller');
    startPolling();
  });
  window.addEventListener('gamepaddisconnected', () => {
    if (!findActivePad()) setConnected(false, '');
  });
  // Clear gamepad highlight when the user uses mouse/touch
  window.addEventListener('pointerdown', () => setGpFocus(null), { passive: true });

  // Also detect already-connected controllers on load (some browsers expose pads on first button/load)
  if (findActivePad()) startPolling();
  const checkTimer = setInterval(() => {
    if (!polling && findActivePad()) startPolling();
  }, 1200);

  return {
    getState: () => state,
    focusFirstInDialog: () => {
      if (!state.connected) return;
      const scope = activeContainer();
      const list = focusablesIn(scope);
      if (list.length) setGpFocus(list[0]);
    },
    destroy: () => {
      clearInterval(checkTimer);
      polling = false;
      if (rafId) cancelAnimationFrame(rafId);
    },
  };
}
