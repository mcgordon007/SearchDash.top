/**
 * SearchDash - Text Selection Floating Toolbar
 * Free: 1 row, 3 engine buttons + locked engines + Upgrade button + "+"
 * Pro:  2 rows (grid), all enabled engines + "+"
 * Customizable via Settings → Selection Toolbar.
 */
(function() {
  'use strict';

  const FREE_LIMIT = 3;
  const TOOLBAR_MAX_WIDTH = 400;

  let toolbar = null;
  let allEngines = [];
  let isPro = false;
  let toolbarEnabled = true;
  let toolbarEngineIds = [];
  let isVisible = false;
  let enginesLoaded = false;

  // ── Load settings from extension ──
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

  // ── Create toolbar DOM ──
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
    `;
    document.body.appendChild(toolbar);
  }

  // ── Get engines to display ──
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

  // ── Build a button element ──
  function makeButton(text, title, opts) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.title = title;
    const locked = opts.locked || false;
    const base = locked
      ? 'border:1px solid #fde68a;color:#92400e;background:#fef3c7;'
      : 'border:1px solid #e2e8f0;color:#1e293b;background:#f8fafc;';
    const hoverIn = locked
      ? 'background:#fde68a;border-color:#f59e0b;'
      : 'background:#eff6ff;border-color:#3b82f6;color:#3b82f6;';
    const hoverOut = locked
      ? 'background:#fef3c7;border-color:#fde68a;color:#92400e;'
      : 'background:#f8fafc;border-color:#e2e8f0;color:#1e293b;';

    btn.style.cssText = `
      padding:5px 10px; border-radius:5px; cursor:pointer;
      font-size:12px; font-weight:600; white-space:nowrap;
      transition:background 0.1s,border-color 0.1s;
      ${opts.minWidth ? 'min-width:' + opts.minWidth + 'px;' : ''}
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
      if (locked) {
        chrome.runtime.sendMessage({ type: 'openPurchasePage' });
      } else if (opts.action === 'search') {
        chrome.runtime.sendMessage(
          { type: 'search', engineId: opts.engineId, query },
          () => { if (chrome.runtime.lastError) console.warn('SearchDash:', chrome.runtime.lastError.message); }
        );
      } else if (opts.action === 'popup') {
        chrome.runtime.sendMessage({ type: 'openPopupWithQuery', query });
      } else if (opts.action === 'upgrade') {
        chrome.runtime.sendMessage({ type: 'openPurchasePage' });
      }
      hideToolbar();
    });
    return btn;
  }

  // ── Render buttons ──
  function renderButtons() {
    if (!toolbar) return;
    toolbar.innerHTML = '';

    const displayEngines = getToolbarEngines();
    if (displayEngines.length === 0) return;

    if (isPro) {
      // ── Pro: 2-column grid, all engines ──
      toolbar.style.display = 'grid';
      toolbar.style.gridTemplateColumns = 'repeat(2, 1fr)';
      toolbar.style.flexWrap = '';

      displayEngines.forEach(engine => {
        const btn = makeButton(engine.name, 'Search ' + engine.name, {
          locked: false, action: 'search', engineId: engine.id, minWidth: 90
        });
        toolbar.appendChild(btn);
      });

      // "+" button
      const plus = makeButton('+', 'Open SearchDash', { locked: false, action: 'popup', minWidth: 0 });
      plus.style.fontWeight = '700';
      plus.style.color = '#64748b';
      plus.style.background = '#f1f5f9';
      toolbar.appendChild(plus);

    } else {
      // ── Free: 1 row, flex nowrap ──
      toolbar.style.display = 'flex';
      toolbar.style.gridTemplateColumns = '';
      toolbar.style.flexWrap = 'nowrap';

      // 3 clickable engines
      const freeEngines = displayEngines.slice(0, FREE_LIMIT);
      freeEngines.forEach(engine => {
        toolbar.appendChild(makeButton(engine.name, 'Search ' + engine.name, {
          locked: false, action: 'search', engineId: engine.id
        }));
      });

      // Locked engines (if any enabled beyond 3)
      const lockedEngines = displayEngines.slice(FREE_LIMIT);
      lockedEngines.forEach(engine => {
        toolbar.appendChild(makeButton(engine.name + ' Pro', 'Pro feature — click to upgrade', {
          locked: true, action: 'upgrade'
        }));
      });

      // "Upgrade" button — always visible for free users
      const upgradeBtn = makeButton('Upgrade', 'Unlock all engines + multi-search', {
        locked: false, action: 'upgrade'
      });
      upgradeBtn.style.background = 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
      upgradeBtn.style.color = '#ffffff';
      upgradeBtn.style.border = 'none';
      upgradeBtn.style.fontWeight = '700';
      toolbar.appendChild(upgradeBtn);

      // "+" button
      const plus = makeButton('+', 'Open SearchDash', { locked: false, action: 'popup' });
      plus.style.fontWeight = '700';
      plus.style.color = '#64748b';
      plus.style.background = '#f1f5f9';
      toolbar.appendChild(plus);
    }
  }

  // ── Position toolbar near selection ──
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

    // Position above the selection, centered horizontally
    let top = rect.top + window.scrollY - 44;
    let left = rect.left + window.scrollX + rect.width / 2;

    const tw = Math.min(toolbar.offsetWidth, TOOLBAR_MAX_WIDTH);
    if (top < window.scrollY + 8) top = rect.bottom + window.scrollY + 8;
    if (left - tw / 2 < 8) left = 8 + tw / 2;
    if (left + tw / 2 > window.innerWidth - 8) left = window.innerWidth - 8 - tw / 2;

    toolbar.style.left = left + 'px';
    toolbar.style.top = top + 'px';
    toolbar.style.transform = 'translateX(-50%)';
    toolbar.style.display = isPro ? 'grid' : 'flex';
    toolbar.style.opacity = '1';
    isVisible = true;
  }

  function hideToolbar() {
    if (toolbar) { toolbar.style.opacity = '0'; toolbar.style.display = 'none'; }
    isVisible = false;
  }

  // ── Listen for selection changes ──
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