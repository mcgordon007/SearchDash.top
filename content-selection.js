/**
 * SearchDash - Text Selection Floating Toolbar
 * Shows a floating 2-row toolbar with engine names when text is selected.
 * Free users see all enabled engines (locked ones show "Pro" badge).
 * Customizable via Settings → Selection Toolbar.
 */
(function() {
  'use strict';

  const FREE_LIMIT = 5;
  const TOOLBAR_MAX_WIDTH = 360;

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
      let enginesDone = false;
      let settingsDone = false;
      let proDone = false;

      function checkDone() {
        if (enginesDone && settingsDone && proDone) {
          enginesLoaded = true;
          resolve();
        }
      }

      chrome.runtime.sendMessage({ type: 'getEngines' }, (resp) => {
        if (resp && resp.success && resp.data) {
          allEngines = resp.data;
        }
        enginesDone = true;
        checkDone();
      });

      chrome.runtime.sendMessage({ type: 'getSettings' }, (resp) => {
        if (resp && resp.success && resp.data) {
          toolbarEnabled = resp.data.selectionToolbarEnabled !== false;
          toolbarEngineIds = resp.data.selectionToolbarEngines || [];
        }
        settingsDone = true;
        checkDone();
      });

      chrome.runtime.sendMessage({ type: 'isPro' }, (resp) => {
        if (resp && resp.success) {
          isPro = resp.data;
        }
        proDone = true;
        checkDone();
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
      position: fixed;
      z-index: 2147483647;
      display: none;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      padding: 6px 8px;
      gap: 5px;
      max-width: ${TOOLBAR_MAX_WIDTH}px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      transition: opacity 0.12s;
      opacity: 0;
      flex-wrap: wrap;
      justify-content: flex-start;
    `;
    document.body.appendChild(toolbar);
  }

  // ── Get engines to display in toolbar ──
  function getToolbarEngines() {
    const enabled = allEngines.filter(e => e.enabled);
    if (toolbarEngineIds.length > 0) {
      // Custom order from settings
      const result = [];
      toolbarEngineIds.forEach(id => {
        const eng = enabled.find(e => e.id === id);
        if (eng) result.push(eng);
      });
      return result;
    }
    return enabled;
  }

  // ── Render engine buttons ──
  function renderButtons() {
    if (!toolbar) return;
    toolbar.innerHTML = '';

    const displayEngines = getToolbarEngines();
    if (displayEngines.length === 0) return;

    // In free mode, first FREE_LIMIT engines are clickable, rest show "Pro" badge
    displayEngines.forEach((engine, idx) => {
      const isLocked = !isPro && idx >= FREE_LIMIT;
      const btn = document.createElement('button');
      btn.textContent = engine.name;
      btn.title = isLocked ? 'Pro feature — click to upgrade' : 'Search ' + engine.name;
      btn.style.cssText = `
        padding: 4px 9px;
        border: 1px solid ${isLocked ? '#fde68a' : '#e2e8f0'};
        border-radius: 5px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        color: ${isLocked ? '#92400e' : '#1e293b'};
        background: ${isLocked ? '#fef3c7' : '#f8fafc'};
        white-space: nowrap;
        transition: background 0.1s, border-color 0.1s;
      `;
      if (isLocked) {
        btn.textContent += ' Pro';
      }

      btn.addEventListener('mouseenter', () => {
        if (isLocked) {
          btn.style.background = '#fde68a';
          btn.style.borderColor = '#f59e0b';
        } else {
          btn.style.background = '#eff6ff';
          btn.style.borderColor = '#3b82f6';
          btn.style.color = '#3b82f6';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (isLocked) {
          btn.style.background = '#fef3c7';
          btn.style.borderColor = '#fde68a';
          btn.style.color = '#92400e';
        } else {
          btn.style.background = '#f8fafc';
          btn.style.borderColor = '#e2e8f0';
          btn.style.color = '#1e293b';
        }
      });

      btn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const sel = window.getSelection();
        const query = sel ? sel.toString().trim() : '';
        if (!query) return;

        if (isLocked) {
          // Free user clicked locked engine → upgrade prompt
          chrome.runtime.sendMessage({ type: 'openPurchasePage' });
        } else {
          chrome.runtime.sendMessage({
            type: 'search',
            engineId: engine.id,
            query
          }, () => {
            if (chrome.runtime.lastError) {
              console.warn('SearchDash: search failed -', chrome.runtime.lastError.message);
            }
          });
        }
        hideToolbar();
      });

      toolbar.appendChild(btn);
    });

    // "+" button to open popup
    const moreBtn = document.createElement('button');
    moreBtn.textContent = '+';
    moreBtn.title = 'Open SearchDash';
    moreBtn.style.cssText = `
      padding: 4px 7px;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      background: #f1f5f9;
      white-space: nowrap;
      transition: background 0.1s;
    `;
    moreBtn.addEventListener('mouseenter', () => {
      moreBtn.style.background = '#e2e8f0';
    });
    moreBtn.addEventListener('mouseleave', () => {
      moreBtn.style.background = '#f1f5f9';
    });
    moreBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    moreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sel = window.getSelection();
      const query = sel ? sel.toString().trim() : '';
      chrome.runtime.sendMessage({
        type: 'openPopupWithQuery',
        query
      });
      hideToolbar();
    });
    toolbar.appendChild(moreBtn);
  }

  // ── Position toolbar near selection ──
  function positionToolbar() {
    if (!toolbarEnabled || !enginesLoaded) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      hideToolbar();
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (!rect || rect.width === 0 || rect.height === 0) {
      hideToolbar();
      return;
    }

    createToolbar();
    renderButtons();

    if (toolbar.children.length === 0) {
      hideToolbar();
      return;
    }

    // Position above the selection, centered horizontally
    let top = rect.top + window.scrollY - 44;
    let left = rect.left + window.scrollX + rect.width / 2;

    // Ensure within viewport
    const toolbarWidth = Math.min(toolbar.offsetWidth, TOOLBAR_MAX_WIDTH);
    if (top < window.scrollY + 8) {
      top = rect.bottom + window.scrollY + 8;
    }
    if (left - toolbarWidth / 2 < 8) {
      left = 8 + toolbarWidth / 2;
    }
    if (left + toolbarWidth / 2 > window.innerWidth - 8) {
      left = window.innerWidth - 8 - toolbarWidth / 2;
    }

    toolbar.style.left = left + 'px';
    toolbar.style.top = top + 'px';
    toolbar.style.transform = 'translateX(-50%)';
    toolbar.style.display = 'flex';
    toolbar.style.opacity = '1';
    isVisible = true;
  }

  function hideToolbar() {
    if (toolbar) {
      toolbar.style.opacity = '0';
      toolbar.style.display = 'none';
    }
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

  // Hide on click outside
  document.addEventListener('mousedown', (e) => {
    if (toolbar && isVisible && !toolbar.contains(e.target)) {
      hideToolbar();
    }
  });

  // Hide on scroll
  document.addEventListener('scroll', () => {
    if (isVisible) {
      hideToolbar();
    }
  }, { passive: true });

  // Reload when storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.engines || changes.settings) {
      loadData();
    }
  });
})();