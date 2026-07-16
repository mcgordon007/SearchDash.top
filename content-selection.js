/**
 * SearchDash - Text Selection Floating Toolbar
 * Shows a floating search toolbar when text is selected on any page
 */
(function() {
  'use strict';

  const EXTENSION_ID = 'mpjpfdlbhfcejfmaafccigkhcdfclfoi';
  let toolbar = null;
  let engines = [];
  let isPro = false;
  let isVisible = false;

  // ── Load engines from extension storage ──
  function loadEngines() {
    chrome.runtime.sendMessage({ type: 'getEngines' }, (resp) => {
      if (resp && resp.success && resp.data) {
        engines = resp.data.filter(e => e.enabled);
      }
    });
    chrome.runtime.sendMessage({ type: 'isPro' }, (resp) => {
      if (resp && resp.success) {
        isPro = resp.data;
      }
    });
  }

  loadEngines();

  // ── Create toolbar ──
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
      padding: 6px;
      gap: 4px;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      transition: opacity 0.12s;
      opacity: 0;
    `;
    document.body.appendChild(toolbar);
  }

  // ── Render engine buttons ──
  function renderButtons() {
    if (!toolbar) return;
    toolbar.innerHTML = '';

    // Show only enabled engines, max 8 for pro / max 5 for free
    const displayEngines = isPro
      ? engines.slice(0, 8)
      : engines.slice(0, 5);

    displayEngines.forEach(engine => {
      const btn = document.createElement('button');
      btn.textContent = engine.name.charAt(0);
      btn.title = 'Search ' + engine.name;
      btn.style.cssText = `
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        color: #fff;
        background: #3b82f6;
        transition: transform 0.1s, opacity 0.1s;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const sel = window.getSelection();
        const query = sel ? sel.toString().trim() : '';
        if (!query) return;
        chrome.runtime.sendMessage({
          type: 'search',
          engineId: engine.id,
          query
        }, () => {
          hideToolbar();
        });
      });
      toolbar.appendChild(btn);
    });

    // "More" button to open full popup
    const moreBtn = document.createElement('button');
    moreBtn.textContent = '+';
    moreBtn.title = 'Open SearchDash';
    moreBtn.style.cssText = `
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      color: #64748b;
      background: #f1f5f9;
      transition: transform 0.1s;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
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

    // Position above the selection, centered horizontally
    let top = rect.top + window.scrollY - 44;
    let left = rect.left + window.scrollX + rect.width / 2;

    // Ensure it's within viewport
    const toolbarWidth = toolbar.offsetWidth || 200;
    if (top < window.scrollY + 8) {
      // Show below instead
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

  // Reload engines when storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.engines) {
      loadEngines();
    }
  });
})();