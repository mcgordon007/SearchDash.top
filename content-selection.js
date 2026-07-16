/**
 * SearchDash - Text Selection Floating Toolbar
 * Free: 3x2 grid — row1: 3 engines, row2: upgrade CTA spanning full width
 * Pro:  3x2 grid — 6 customizable engines, equal width
 * Customizable via Settings → Selection Toolbar (Pro: pick up to 6 engines)
 */
(function() {
  'use strict';

  const FREE_LIMIT = 3;
  const PRO_LIMIT = 6;
  const TOOLBAR_MAX_WIDTH = 400;

  let toolbar = null;
  let allEngines = [];
  let isPro = false;
  let toolbarEnabled = true;
  let toolbarEngineIds = [];
  let isVisible = false;
  let enginesLoaded = false;

  // ── Load settings ──
  async function loadData() {
    return new Promise((resolve) => {
      let enginesDone = false, settingsDone = false, proDone = false;
      function checkDone() {
        if (enginesDone && settingsDone && proDone) { enginesLoaded = true; resolve(); }
      }
      chrome.runtime.sendMessage({ type: 'getEngines' }, (resp) => {
        if (resp && resp.success && resp.data) allEngines = resp.data;
        enginesDone = true; checkDone();
      });
      chrome.runtime.sendMessage({ type: 'getSettings' }, (resp) => {
        if (resp && resp.success && resp.data) {
          toolbarEnabled = resp.data.selectionToolbarEnabled !== false;
          toolbarEngineIds = resp.data.selectionToolbarEngines || [];
        }
        settingsDone = true; checkDone();
      });
      chrome.runtime.sendMessage({ type: 'isPro' }, (resp) => {
        if (resp && resp.success) isPro = resp.data;
        proDone = true; checkDone();
      });
    });
  }
  loadData();

  // ── Create toolbar ──
  function createToolbar() {
    if (toolbar) return;
    toolbar = document.createElement('div');
    toolbar.id = 'searchdash-float-toolbar';
    toolbar.style.cssText = `
      position: fixed; z-index: 2147483647; display: none;
      background: #ffffff; border: 1px solid #e2e8f0;
      border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      padding: 5px 7px; gap: 5px; max-width: ${TOOLBAR_MAX_WIDTH}px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      user-select: none; -webkit-user-select: none;
      transition: opacity 0.12s; opacity: 0;
      display: grid; grid-template-columns: repeat(3, 1fr);
    `;
    document.body.appendChild(toolbar);
  }

  // ── Get engines (custom order or all enabled) ──
  function getToolbarEngines() {
    const enabled = allEngines.filter(e => e.enabled);
    if (toolbarEngineIds.length > 0) {
      const result = [];
      toolbarEngineIds.forEach(id => {
        const eng = enabled.find(e => e.id === id);
        if (eng) result.push(eng);
      });
      return result;
    }
    return enabled;
  }

  // ── Button factory ──
  function makeButton(text, html, opts) {
    const btn = document.createElement('button');
    if (html) {
      btn.innerHTML = html;
    } else {
      btn.textContent = text;
    }
    btn.title = opts.title || '';
    const locked = opts.locked || false;
    const base = locked
      ? 'border:1px solid #fde68a;color:#92400e;background:#fef3c7;'
      : opts.primary
        ? 'border:none;color:#ffffff;background:linear-gradient(135deg, #3b82f6, #8b5cf6);'
        : 'border:1px solid #e2e8f0;color:#1e293b;background:#f8fafc;';
    const hoverIn = locked
      ? 'background:#fde68a;border-color:#f59e0b;'
      : opts.primary
        ? 'background:linear-gradient(135deg, #2563eb, #7c3aed);'
        : 'background:#eff6ff;border-color:#3b82f6;color:#3b82f6;';
    const hoverOut = locked
      ? 'background:#fef3c7;border-color:#fde68a;color:#92400e;'
      : opts.primary
        ? 'background:linear-gradient(135deg, #3b82f6, #8b5cf6);'
        : 'background:#f8fafc;border-color:#e2e8f0;color:#1e293b;';

    btn.style.cssText = `
      padding:6px 0; border-radius:5px; cursor:pointer;
      font-size:12px; font-weight:600; white-space:nowrap;
      transition:background 0.1s,border-color 0.1s;
      text-align:center; width:100%;
      ${opts.colSpan ? 'grid-column: span ' + opts.colSpan + ';' : ''}
      ${base}
    `;
    btn.addEventListener('mouseenter', () => { btn.style.cssText += hoverIn; });
    btn.addEventListener('mouseleave', () => { btn.style.cssText += hoverOut; });
    btn.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const sel = window.getSelection();
      const query = sel ? sel.toString().trim() : '';
      if (!query) return;
      if (opts.action === 'search') {
        chrome.runtime.sendMessage(
          { type: 'search', engineId: opts.engineId, query },
          () => { if (chrome.runtime.lastError) console.warn('SearchDash:', chrome.runtime.lastError.message); }
        );
      } else if (opts.action === 'upgrade') {
        chrome.runtime.sendMessage({ type: 'openPurchasePage' });
      }
      hideToolbar();
    });
    return btn;
  }

  // ── Render ──
  function renderButtons() {
    if (!toolbar) return;
    toolbar.innerHTML = '';

    const displayEngines = getToolbarEngines();
    if (displayEngines.length === 0) return;

    if (isPro) {
      // ── Pro: 3×2 grid, 6 engines, user-customizable ──
      const proEngines = displayEngines.slice(0, PRO_LIMIT);
      proEngines.forEach(engine => {
        toolbar.appendChild(makeButton(engine.name, null, {
          locked: false, action: 'search', engineId: engine.id,
          title: 'Search ' + engine.name
        }));
      });

      // Fill empty slots to keep grid stable (so all buttons have equal width)
      const emptySlots = PRO_LIMIT - proEngines.length;
      for (let i = 0; i < emptySlots; i++) {
        const empty = document.createElement('div');
        empty.style.cssText = 'visibility:hidden;';
        toolbar.appendChild(empty);
      }

    } else {
      // ── Free: 3×2 grid — row1: 3 engines, row2: upgrade CTA ──
      const freeEngines = displayEngines.slice(0, FREE_LIMIT);
      freeEngines.forEach(engine => {
        toolbar.appendChild(makeButton(engine.name, null, {
          locked: false, action: 'search', engineId: engine.id,
          title: 'Search ' + engine.name
        }));
      });

      // Fill row 1 empty slots
      const emptySlots = FREE_LIMIT - freeEngines.length;
      for (let i = 0; i < emptySlots; i++) {
        const empty = document.createElement('div');
        empty.style.cssText = 'visibility:hidden;';
        toolbar.appendChild(empty);
      }

      // Row 2: upgrade CTA spanning all 3 columns
      toolbar.appendChild(makeButton(null, 'Upgrade to Pro &mdash; Unlock More Engines', {
        primary: true, action: 'upgrade', colSpan: 3,
        title: 'Upgrade to Pro — unlock all engines + multi-search'
      }));
    }
  }

  // ── Position ──
  function positionToolbar() {
    if (!toolbarEnabled || !enginesLoaded) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) { hideToolbar(); return; }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) { hideToolbar(); return; }

    createToolbar();
    renderButtons();

    if (toolbar.children.length === 0) { hideToolbar(); return; }

    let top = rect.top + window.scrollY - 52;
    let left = rect.left + window.scrollX + rect.width / 2;

    const tw = Math.min(toolbar.offsetWidth, TOOLBAR_MAX_WIDTH);
    if (top < window.scrollY + 8) top = rect.bottom + window.scrollY + 8;
    if (left - tw / 2 < 8) left = 8 + tw / 2;
    if (left + tw / 2 > window.innerWidth - 8) left = window.innerWidth - 8 - tw / 2;

    toolbar.style.left = left + 'px';
    toolbar.style.top = top + 'px';
    toolbar.style.transform = 'translateX(-50%)';
    toolbar.style.opacity = '1';
    isVisible = true;
  }

  function hideToolbar() {
    if (toolbar) { toolbar.style.opacity = '0'; toolbar.style.display = 'none'; }
    isVisible = false;
  }

  // ── Events ──
  let selectionTimer = null;
  document.addEventListener('selectionchange', () => {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
      if (!toolbarEnabled) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        positionToolbar();
      } else {
        hideToolbar();
      }
    }, 200);
  });

  document.addEventListener('mousedown', (e) => {
    if (toolbar && isVisible && !toolbar.contains(e.target)) hideToolbar();
  });
  document.addEventListener('scroll', () => { if (isVisible) hideToolbar(); }, { passive: true });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.engines || changes.settings) loadData();
  });
})();