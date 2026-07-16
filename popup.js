/**
 * SearchDash - Popup Script
 * Features: category tabs, dark mode, multi-search, text selection
 */
document.addEventListener('DOMContentLoaded', async () => {
  const searchInput = document.getElementById('searchInput');
  const engineGrid = document.getElementById('engineGrid');
  const categoryTabs = document.getElementById('categoryTabs');
  const multiToggle = document.getElementById('multiToggle');
  const multiActionBar = document.getElementById('multiActionBar');
  const multiCount = document.getElementById('multiCount');
  const multiSearchBtn = document.getElementById('multiSearchBtn');
  const multiProPrompt = document.getElementById('multiProPrompt');
  const multiProLink = document.getElementById('multiProLink');
  const openSettingsBtn = document.getElementById('openSettings');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const proBadge = document.getElementById('proBadge');
  const darkToggle = document.getElementById('darkToggle');
  const tabsScroll = document.getElementById('tabsScroll');

  const FREE_ENGINE_LIMIT = 5;

  let isProUser = false;
  let multiMode = false;
  let selectedEngines = new Set();
  let allEngines = [];
  let categories = [];
  let activeCategory = 'general';

  // ── Dark Mode ──
  function initDarkMode() {
    chrome.storage.sync.get(['darkMode'], (result) => {
      const dark = result.darkMode === true;
      applyDarkMode(dark);
    });
  }

  function applyDarkMode(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    darkToggle.textContent = dark ? '☀️' : '🌙';
  }

  function toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = !current;
    applyDarkMode(next);
    chrome.storage.sync.set({ darkMode: next });
  }

  darkToggle.addEventListener('click', toggleDarkMode);
  initDarkMode();

  // ── Pro Status ──
  chrome.runtime.sendMessage({ type: 'isPro' }, (response) => {
    isProUser = response && response.success && response.data;
    if (isProUser) {
      upgradeBtn.textContent = 'Pro';
      upgradeBtn.classList.add('pro-active');
      upgradeBtn.title = 'You have Pro access';
      proBadge.textContent = 'Pro';
      proBadge.style.background = '#ecfdf5';
      proBadge.style.color = '#059669';
    }
  });

  // ── Load Engines & Categories ──
  chrome.runtime.sendMessage({ type: 'getCategories' }, (catResp) => {
    if (catResp && catResp.success && catResp.data) {
      categories = catResp.data;
    }
    chrome.runtime.sendMessage({ type: 'getEngines' }, (engResp) => {
      if (engResp && engResp.success) {
        allEngines = engResp.data;
      }
      renderCategoryTabs();
      renderEngineButtons();
    });
  });

  // ── Category Tabs (2-row grid with left/right pagination) ──
  const TABS_PER_PAGE = 6; // 3 columns × 2 rows
  let tabPage = 0;

  function renderCategoryTabs() {
    categoryTabs.innerHTML = '';
    if (categories.length === 0) return;

    const start = tabPage * TABS_PER_PAGE;
    const page = categories.slice(start, start + TABS_PER_PAGE);
    const totalPages = Math.ceil(categories.length / TABS_PER_PAGE);

    page.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'tab' + (cat.id === activeCategory ? ' active' : '');
      btn.textContent = cat.label;
      btn.addEventListener('click', () => {
        activeCategory = cat.id;
        renderCategoryTabs();
        if (multiMode) {
          selectedEngines.clear();
          updateMultiActionBar();
        }
        renderEngineButtons();
      });
      categoryTabs.appendChild(btn);
    });

    // Fill empty slots to keep grid stable
    for (let i = page.length; i < TABS_PER_PAGE; i++) {
      const empty = document.createElement('div');
      categoryTabs.appendChild(empty);
    }

    document.getElementById('tabLeft').classList.toggle('hidden', tabPage === 0);
    document.getElementById('tabRight').classList.toggle('hidden', tabPage >= totalPages - 1);
  }

  document.getElementById('tabLeft').addEventListener('click', () => {
    if (tabPage > 0) {
      tabPage--;
      renderCategoryTabs();
    }
  });

  document.getElementById('tabRight').addEventListener('click', () => {
    const totalPages = Math.ceil(categories.length / TABS_PER_PAGE);
    if (tabPage < totalPages - 1) {
      tabPage++;
      renderCategoryTabs();
    }
  });

  // ── Engine Buttons ──
  function renderEngineButtons() {
    engineGrid.innerHTML = '';
    if (multiMode) {
      engineGrid.classList.add('multi-mode');
    } else {
      engineGrid.classList.remove('multi-mode');
    }

    // Multi-mode: show ALL enabled engines across all categories
    // Single-mode: show only engines in the active category
    const displayEngines = multiMode
      ? allEngines.filter(e => e.enabled)
      : allEngines.filter(e => e.category === activeCategory);
    if (displayEngines.length === 0) {
      engineGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--muted);font-size:12px;">' + (multiMode ? 'No engines enabled' : 'No engines in this category') + '</div>';
      return;
    }

    displayEngines.forEach((engine, idx) => {
      const enabledCount = allEngines.filter(e => e.enabled).length;
      const isEngineEnabled = engine.enabled;
      const isBeyondFreeLimit = !isProUser && enabledCount >= FREE_ENGINE_LIMIT && !engine.enabled;
      const isLocked = !isEngineEnabled && isBeyondFreeLimit;

      const btn = document.createElement('div');
      btn.className = 'engine-btn';
      if (isLocked) btn.classList.add('locked');
      if (multiMode && selectedEngines.has(engine.id)) btn.classList.add('multi-selected');

      const iconClass = engine.id === 'google' ? 'ei-google' :
        engine.id === 'bing' ? 'ei-bing' :
        engine.id === 'duckduckgo' ? 'ei-duckduckgo' :
        engine.id === 'yahoo' ? 'ei-yahoo' :
        engine.id === 'brave' ? 'ei-brave' :
        engine.id === 'github' ? 'ei-github' :
        engine.id === 'stackoverflow' ? 'ei-stackoverflow' :
        engine.id === 'mdn' ? 'ei-mdn' :
        engine.id === 'npm' ? 'ei-npm' :
        engine.id === 'pypi' ? 'ei-pypi' :
        engine.id === 'wikipedia' ? 'ei-wikipedia' :
        engine.id === 'reddit' ? 'ei-reddit' :
        engine.id === 'quora' ? 'ei-quora' :
        engine.id === 'wolfram' ? 'ei-wolfram' :
        engine.id === 'amazon' ? 'ei-amazon' :
        engine.id === 'ebay' ? 'ei-ebay' :
        engine.id === 'etsy' ? 'ei-etsy' :
        engine.id === 'walmart' ? 'ei-walmart' :
        engine.id === 'youtube' ? 'ei-youtube' :
        engine.id === 'vimeo' ? 'ei-vimeo' :
        engine.id === 'twitch' ? 'ei-twitch' :
        engine.id === 'x' ? 'ei-x' :
        engine.id === 'linkedin' ? 'ei-linkedin' :
        engine.id === 'facebook' ? 'ei-facebook' :
        '';

      btn.innerHTML = `
        ${isLocked ? '<span class="lock-icon">🔒</span>' : ''}
        <div class="engine-icon ${iconClass}">${engine.name.charAt(0)}</div>
        <span class="engine-name">${engine.name}</span>
      `;

      btn.addEventListener('click', () => {
        if (multiMode) {
          // Multi-select mode
          if (selectedEngines.has(engine.id)) {
            selectedEngines.delete(engine.id);
          } else {
            selectedEngines.add(engine.id);
          }
          updateMultiActionBar();
          renderEngineButtons();
        } else if (isLocked) {
          // Locked engine → prompt upgrade
          chrome.tabs.create({ url: chrome.runtime.getURL('purchase.html') });
          window.close();
        } else {
          // Single search
          const query = searchInput.value.trim();
          if (!query) {
            searchInput.focus();
            return;
          }
          chrome.runtime.sendMessage(
            { type: 'search', engineId: engine.id, query },
            () => window.close()
          );
        }
      });

      engineGrid.appendChild(btn);
    });
  }

  // ── Multi-Search ──
  multiToggle.addEventListener('click', () => {
    if (!isProUser) {
      multiProPrompt.classList.add('visible');
      return;
    }
    multiMode = !multiMode;
    multiToggle.classList.toggle('active', multiMode);
    if (multiMode) {
      tabsScroll.style.display = 'none';
      multiActionBar.classList.add('visible');
      multiProPrompt.classList.remove('visible');
      selectedEngines.clear();
    } else {
      tabsScroll.style.display = '';
      multiActionBar.classList.remove('visible');
      selectedEngines.clear();
    }
    updateMultiActionBar();
    renderEngineButtons();
  });

  multiProLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('purchase.html') });
    window.close();
  });

  function updateMultiActionBar() {
    multiCount.textContent = selectedEngines.size + ' engine' + (selectedEngines.size !== 1 ? 's' : '') + ' selected';
    multiSearchBtn.disabled = selectedEngines.size === 0;
  }

  multiSearchBtn.addEventListener('click', () => {
    if (selectedEngines.size === 0) return;
    const query = searchInput.value.trim();
    if (!query) {
      searchInput.focus();
      return;
    }
    chrome.runtime.sendMessage(
      { type: 'multiSearch', engineIds: Array.from(selectedEngines), query },
      () => window.close()
    );
  });

  // ── Keyboard: Enter to search ──
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (!query) return;

      if (multiMode && selectedEngines.size > 0) {
        chrome.runtime.sendMessage(
          { type: 'multiSearch', engineIds: Array.from(selectedEngines), query },
          () => window.close()
        );
      } else {
        // Use default engine or first enabled engine
        chrome.runtime.sendMessage({ type: 'getSettings' }, (resp) => {
          const settings = resp && resp.data ? resp.data : {};
          const defaultId = settings.defaultEngine || 'google';
          chrome.runtime.sendMessage(
            { type: 'search', engineId: defaultId, query },
            () => window.close()
          );
        });
      }
    }
  });

  // ── Settings & Upgrade ──
  openSettingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  upgradeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('purchase.html') });
    window.close();
  });

  proBadge.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isProUser) {
      chrome.tabs.create({ url: chrome.runtime.getURL('purchase.html') });
      window.close();
    }
  });

  // ── Get selected text from current page ──
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
      return;
    }
    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, func: () => window.getSelection()?.toString().trim() || '' },
      (results) => {
        if (results && results[0] && results[0].result) {
          searchInput.value = results[0].result;
          searchInput.select();
        }
      }
    );
  });
});