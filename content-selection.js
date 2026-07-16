/**
 * SearchDash - Text Selection Floating Toolbar
 * Shows a floating search toolbar with engine names when text is selected on any page
 */
(function() {
  'use strict';

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
      padding: 6px 8px;
      gap: 6px;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      transition: opacity 0.12s;
      opacity: 0;
    `;
    document.body.appendChild(toolbar);
  }

  // ── Render engine buttons with full names ──
  function renderButtons() {
    if (!toolbar) return;
    toolbar.innerHTML = '';

    // Show only enabled engines, max 8 for pro / max 5 for free
    const maxEngines = isPro ? 8 : 5;
    const displayEngines = engines.slice(0, maxEngines);

    displayEngines.forEach(engine => {
      const btn = document.createElement('button');
      btn.textContent = engine.name;
      btn.title = 'Search ' + engine.name;
      btn.style.cssText = `
        padding: 5px 10px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        color: #1e293b;
        background: #f8fafc;
        white-space: nowrap;
        transition: background 0.1s, border-color 0.1s;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#eff6ff';
        btn.style.borderColor = '#3b82f6';
        btn.style.color = '#3b82f6';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#f8fafc';
        btn.style.borderColor = '#e2e8f0';
        btn.style.color = '#1e293b';
      });
      btn.addEventListener('mousedown', (e) => {
        // Stop propagation so the document mousedown doesn't hide the toolbar
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
          if (chrome.runtime.lastError) {
            console.warn('SearchDash: search failed -', chrome.runtime.lastError.message);
          }
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
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
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