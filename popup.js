/**
 * SearchDash - Popup Script
 * ==============================
 * Features:
 * 1. Get selected text from the current page and display it
 * 2. Render search engine button grid
 * 3. Handle click-to-search events
 * 4. Multi-Search mode (Pro): select multiple engines, search all at once
 * 5. Settings page entry point
 */

document.addEventListener('DOMContentLoaded', async () => {
  const selectionTextEl = document.getElementById('selectionText');
  const engineGridEl = document.getElementById('engineGrid');
  const openSettingsBtn = document.getElementById('openSettings');
  const upgradeBtn = document.getElementById('upgradeBtn');

  // Multi-search elements
  const multiToggle = document.getElementById('multiToggle');
  const multiActionBar = document.getElementById('multiActionBar');
  const multiCount = document.getElementById('multiCount');
  const multiSearchBtn = document.getElementById('multiSearchBtn');
  const multiProPrompt = document.getElementById('multiProPrompt');
  const multiProLink = document.getElementById('multiProLink');

  // State
  let isProUser = false;
  let multiMode = false;
  let selectedEngines = new Set();
  let allEngines = [];

  // ── Pro status check ──────────────────────────────────
  chrome.runtime.sendMessage({ type: 'isPro' }, (response) => {
    isProUser = response && response.success && response.data;
    if (isProUser) {
      upgradeBtn.textContent = 'Pro';
      upgradeBtn.classList.add('pro-active');
      upgradeBtn.title = 'You have Pro access';
    }
  });

  // ── Event listeners ───────────────────────────────────

  openSettingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  upgradeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('purchase.html') });
    window.close();
  });

  // Multi-Search toggle
  multiToggle.addEventListener('click', () => {
    if (!isProUser) {
      multiProPrompt.classList.add('visible');
      return;
    }
    multiMode = !multiMode;
    if (multiMode) {
      multiToggle.classList.add('active');
      multiActionBar.classList.add('visible');
      multiProPrompt.classList.remove('visible');
      selectedEngines.clear();
      renderEngineButtons(true);
      updateMultiActionBar();
    } else {
      multiToggle.classList.remove('active');
      multiActionBar.classList.remove('visible');
      selectedEngines.clear();
      renderEngineButtons(false);
    }
  });

  // Pro upgrade link in multi-search prompt
  multiProLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('purchase.html') });
    window.close();
  });

  // Multi-search execute button
  multiSearchBtn.addEventListener('click', () => {
    if (selectedEngines.size === 0) return;
    const query = selectionTextEl.value.trim();
    if (!query) {
      selectionTextEl.focus();
      return;
    }

    const engineIds = Array.from(selectedEngines);
    chrome.runtime.sendMessage(
      { type: 'multiSearch', engineIds, query },
      (response) => {
        if (response && response.success) {
          window.close();
        } else {
          console.error('Multi-search failed:', response?.error);
          alert('Search failed: ' + (response?.error || 'Unknown error'));
        }
      }
    );
  });

  // Keyboard shortcut: Ctrl/Cmd+Enter to search with default engine
  selectionTextEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !multiMode) {
      chrome.runtime.sendMessage({ type: 'getSettings' }, (response) => {
        if (response && response.success) {
          performSearch(response.data.defaultEngine);
        }
      });
    }
  });

  // ── Get selected text ─────────────────────────────────
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab.id) {
      chrome.scripting.executeScript(
        {
          target: { tabId: activeTab.id },
          function: () => window.getSelection().toString().trim()
        },
        (results) => {
          if (chrome.runtime.lastError) return;
          if (results && results[0] && results[0].result) {
            selectionTextEl.value = results[0].result;
          }
        }
      );
    }
  } catch (error) {
    console.warn('Failed to get selected text:', error);
  }

  // ── Load and render engines ───────────────────────────
  chrome.runtime.sendMessage({ type: 'getEngines' }, (response) => {
    if (!response || !response.success) {
      engineGridEl.innerHTML = '<div class="empty-state">Failed to load search engines. Please try again.</div>';
      return;
    }

    allEngines = response.data.filter(e => e.enabled);

    if (allEngines.length === 0) {
      engineGridEl.innerHTML = '<div class="empty-state">No engines enabled. Go to Settings to add some.</div>';
      return;
    }

    chrome.runtime.sendMessage({ type: 'isPro' }, (proResponse) => {
      isProUser = proResponse && proResponse.success && proResponse.data;
      const FREE_LIMIT = 5;
      const visibleEngines = isProUser ? allEngines : allEngines.slice(0, FREE_LIMIT);
      const lockedCount = allEngines.length - visibleEngines.length;

      renderEngineButtons(false, visibleEngines);

      if (!isProUser && lockedCount > 0) {
        renderUnlockBanner(lockedCount);
      }
    });
  });

  // ── Render functions ──────────────────────────────────

  function renderEngineButtons(multi, enginesOverride) {
    engineGridEl.innerHTML = '';
    const engines = enginesOverride || (multi ? allEngines : allEngines);

    engines.forEach(engine => {
      const button = document.createElement('button');
      button.className = 'engine-button';
      button.dataset.engineId = engine.id;

      if (multi) {
        button.classList.add('multi-mode');
        if (selectedEngines.has(engine.id)) {
          button.classList.add('selected');
        }
      }

      const iconClass = `engine-icon ${engine.id}`;
      const iconText = engine.name.charAt(0);

      const checkboxHtml = multi
        ? '<span class="engine-checkbox"></span>'
        : '';

      button.innerHTML = `
        ${checkboxHtml}
        <span class="${iconClass}">${iconText}</span>
        <span class="engine-name">${engine.name}</span>
        ${engine.shortcut ? `<span class="shortcut">${engine.shortcut}</span>` : ''}
      `;

      button.addEventListener('click', () => {
        if (multi) {
          toggleEngineSelection(engine.id, button);
        } else {
          performSearch(engine.id);
        }
      });

      engineGridEl.appendChild(button);
    });
  }

  function renderUnlockBanner(lockedCount) {
    const unlockRow = document.createElement('div');
    unlockRow.className = 'unlock-banner';
    unlockRow.innerHTML = `
      <span class="unlock-icon">🔒</span>
      <span class="unlock-text">+${lockedCount} more engines available</span>
      <a class="unlock-link" id="unlockLink">Unlock All →</a>
    `;
    engineGridEl.appendChild(unlockRow);

    document.getElementById('unlockLink').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('purchase.html') });
      window.close();
    });
  }

  // ── Multi-search helpers ──────────────────────────────

  function toggleEngineSelection(engineId, button) {
    if (selectedEngines.has(engineId)) {
      selectedEngines.delete(engineId);
      button.classList.remove('selected');
    } else {
      selectedEngines.add(engineId);
      button.classList.add('selected');
    }
    updateMultiActionBar();
  }

  function updateMultiActionBar() {
    const count = selectedEngines.size;
    multiCount.innerHTML = `<strong>${count}</strong> selected`;
    multiSearchBtn.disabled = count === 0;
    multiSearchBtn.textContent = count > 0 ? `Search ${count} Engines` : 'Search Selected';
  }

  // ── Single search ─────────────────────────────────────

  function performSearch(engineId) {
    const query = selectionTextEl.value.trim();
    if (!query) {
      selectionTextEl.focus();
      return;
    }

    chrome.runtime.sendMessage(
      { type: 'search', engineId, query },
      (response) => {
        if (response && response.success) {
          window.close();
        } else {
          console.error('Search failed:', response?.error);
          alert('Search failed: ' + (response?.error || 'Unknown error'));
        }
      }
    );
  }
});