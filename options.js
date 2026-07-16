/**
 * SearchDash - Options Page
 * Category display, dark mode, engine management
 */
document.addEventListener('DOMContentLoaded', async () => {
  const engineListEl = document.getElementById('engineList');
  const proCountEl = document.getElementById('proCount');
  const proBarFillEl = document.getElementById('proBarFill');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const saveAllBtn = document.getElementById('saveAllBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusMessage = document.getElementById('statusMessage');
  const darkToggle = document.getElementById('darkToggle');
  const settingOpenInNewTab = document.getElementById('settingOpenInNewTab');
  const settingShowContextMenu = document.getElementById('settingShowContextMenu');
  const settingDefaultEngine = document.getElementById('settingDefaultEngine');

  const FREE_ENGINE_LIMIT = 5;
  let engines = [];
  let categories = [];
  let isProUser = false;

  // ── Dark Mode ──
  function initDarkMode() {
    chrome.storage.sync.get(['darkMode'], (result) => {
      applyDarkMode(result.darkMode === true);
    });
  }

  function applyDarkMode(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    darkToggle.textContent = dark ? '☀️' : '🌙';
  }

  darkToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = !current;
    applyDarkMode(next);
    chrome.storage.sync.set({ darkMode: next });
  });
  initDarkMode();

  // ── Load Data ──
  chrome.runtime.sendMessage({ type: 'getCategories' }, (catResp) => {
    if (catResp && catResp.success) categories = catResp.data;

    chrome.runtime.sendMessage({ type: 'getEngines' }, (engResp) => {
      if (engResp && engResp.success) engines = engResp.data;
      chrome.runtime.sendMessage({ type: 'isPro' }, (proResp) => {
        isProUser = proResp && proResp.success && proResp.data;
        renderAll();
      });
    });
  });

  // ── Render ──
  function renderAll() {
    renderEngineList();
    updateProBar();
    updateUpgradeButton();
    loadSettings();
  }

  function getCategoryLabel(catId) {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.label : catId;
  }

  function renderEngineList() {
    engineListEl.innerHTML = '';
    const enabledCount = engines.filter(e => e.enabled).length;

    // Group by category
    const grouped = {};
    engines.forEach(e => {
      const cat = e.category || 'general';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(e);
    });

    categories.forEach(cat => {
      const catEngines = grouped[cat.id] || [];
      if (catEngines.length === 0) return;

      const catHeader = document.createElement('div');
      catHeader.className = 'category-header';
      catHeader.textContent = cat.label;
      engineListEl.appendChild(catHeader);

      catEngines.forEach((engine, idx) => {
        const isBeyondFreeLimit = !isProUser && enabledCount >= FREE_ENGINE_LIMIT && !engine.enabled;
        const isLocked = !engine.enabled && isBeyondFreeLimit;

        const item = document.createElement('div');
        item.className = 'engine-item' + (isLocked ? ' locked' : '');
        item.innerHTML = `
          <span class="drag-handle">⋮⋮</span>
          <div class="engine-icon ${engineIdToIconClass(engine.id)}">${engine.name.charAt(0)}</div>
          <div class="engine-info">
            <div class="engine-name">${engine.name}</div>
            <div class="engine-url">${engine.url}</div>
          </div>
          <span class="engine-shortcut">${engine.shortcut}</span>
          ${isLocked ? '<span class="pro-badge">PRO</span>' : ''}
          <button class="engine-toggle ${engine.enabled ? 'on' : ''}" data-engine-id="${engine.id}"></button>
        `;

        const toggleBtn = item.querySelector('.engine-toggle');
        toggleBtn.addEventListener('click', () => {
          if (isLocked) {
            if (isProUser) {
              // Pro user can toggle any engine
              engine.enabled = true;
              renderAll();
            } else {
              // Free user — prompt upgrade
              chrome.tabs.create({ url: chrome.runtime.getURL('purchase.html') });
            }
            return;
          }
          engine.enabled = !engine.enabled;
          renderAll();
        });

        engineListEl.appendChild(item);
      });
    });
  }

  function updateProBar() {
    const enabledCount = engines.filter(e => e.enabled).length;
    proCountEl.textContent = `${enabledCount}/${isProUser ? engines.length : FREE_ENGINE_LIMIT} engines enabled`;
    const pct = isProUser ? (enabledCount / engines.length * 100) : (enabledCount / FREE_ENGINE_LIMIT * 100);
    proBarFillEl.style.width = Math.min(pct, 100) + '%';
  }

  function updateUpgradeButton() {
    if (isProUser) {
      upgradeBtn.textContent = 'Pro Active';
      upgradeBtn.classList.add('pro-active');
      upgradeBtn.disabled = true;
    } else {
      upgradeBtn.textContent = 'Upgrade to Pro';
      upgradeBtn.classList.remove('pro-active');
      upgradeBtn.disabled = false;
    }
  }

  upgradeBtn.addEventListener('click', () => {
    if (!isProUser) {
      chrome.tabs.create({ url: chrome.runtime.getURL('purchase.html') });
    }
  });

  // ── Settings ──
  function loadSettings() {
    chrome.runtime.sendMessage({ type: 'getSettings' }, (resp) => {
      if (!resp || !resp.success) return;
      const settings = resp.data;
      settingOpenInNewTab.checked = settings.openInNewTab !== false;
      settingShowContextMenu.checked = settings.showContextMenu !== false;

      // Populate default engine dropdown
      settingDefaultEngine.innerHTML = '';
      engines.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.name;
        if (e.id === settings.defaultEngine) opt.selected = true;
        settingDefaultEngine.appendChild(opt);
      });
    });
  }

  settingOpenInNewTab.addEventListener('change', () => autoSaveSettings());
  settingShowContextMenu.addEventListener('change', () => autoSaveSettings());
  settingDefaultEngine.addEventListener('change', () => autoSaveSettings());

  async function autoSaveSettings() {
    const settings = {
      openInNewTab: settingOpenInNewTab.checked,
      showContextMenu: settingShowContextMenu.checked,
      defaultEngine: settingDefaultEngine.value
    };
    chrome.runtime.sendMessage({ type: 'saveSettings', settings }, () => {
      chrome.runtime.sendMessage({ type: 'rebuildContextMenus' });
    });
  }

  // ── Save All ──
  saveAllBtn.addEventListener('click', () => {
    autoSaveSettings();
    chrome.runtime.sendMessage({ type: 'saveEngines', engines }, () => {
      showToast('Settings saved successfully!');
      renderAll();
    });
  });

  // ── Reset ──
  resetBtn.addEventListener('click', () => {
    if (!confirm('Reset all engines and settings to defaults? This cannot be undone.')) return;
    chrome.runtime.sendMessage({ type: 'resetDefaults' }, () => {
      chrome.runtime.sendMessage({ type: 'getEngines' }, (resp) => {
        if (resp && resp.success) {
          engines = resp.data;
          renderAll();
          loadSettings();
        }
      });
      showToast('Restored to defaults');
    });
  });

  // ── Toast ──
  function showToast(msg, isError) {
    statusMessage.textContent = msg;
    statusMessage.classList.toggle('error', isError);
    statusMessage.classList.add('show');
    setTimeout(() => statusMessage.classList.remove('show'), 2500);
  }

  // ── Helpers ──
  function engineIdToIconClass(id) {
    const map = {
      google: 'google', bing: 'bing', duckduckgo: 'duckduckgo', github: 'github',
      stackoverflow: 'stackoverflow', wikipedia: 'wikipedia', reddit: 'reddit',
      amazon: 'amazon', youtube: 'youtube', x: 'x', yahoo: 'yahoo', brave: 'brave',
      mdn: 'mdn', npm: 'npm', pypi: 'pypi', quora: 'quora', wolfram: 'wolfram',
      ebay: 'ebay', etsy: 'etsy', walmart: 'walmart', vimeo: 'vimeo', twitch: 'twitch',
      linkedin: 'linkedin', facebook: 'facebook', perplexity: 'perplexity',
      chatgpt: 'chatgpt', gemini: 'gemini'
    };
    return map[id] ? 'engine-icon ' + map[id] : '';
  }
});