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
  const settingSelectionToolbar = document.getElementById('settingSelectionToolbar');
  const toolbarEngineList = document.getElementById('toolbarEngineList');
  const customEngineName = document.getElementById('customEngineName');
  const customEngineUrl = document.getElementById('customEngineUrl');
  const customEngineCat = document.getElementById('customEngineCat');
  const addCustomEngineBtn = document.getElementById('addCustomEngineBtn');

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
        const isCustom = engine.custom === true;

        const item = document.createElement('div');
        item.className = 'engine-item' + (isLocked ? ' locked' : '');
        item.innerHTML = `
          <span class="drag-handle">⋮⋮</span>
          <div class="engine-icon ${engineIdToIconClass(engine.id)}">${engine.name.charAt(0)}</div>
          <div class="engine-info">
            <div class="engine-name">${engine.name}${isCustom ? ' <span style="font-size:9px;color:var(--accent);font-weight:700;">CUSTOM</span>' : ''}</div>
            <div class="engine-url">${engine.url}</div>
          </div>
          <span class="engine-shortcut">${engine.shortcut}</span>
          ${isCustom ? '<button class="engine-delete-btn" data-engine-id="' + engine.id + '" title="Remove custom engine" style="padding:2px 6px;border:1px solid var(--danger);border-radius:4px;background:transparent;color:var(--danger);cursor:pointer;font-size:11px;">&times;</button>' : ''}
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

        // Delete button for custom engines
        const deleteBtn = item.querySelector('.engine-delete-btn');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', () => {
            if (!confirm('Delete "' + engine.name + '"? This cannot be undone.')) return;
            engines = engines.filter(e => e.id !== engine.id);
            renderAll();
          });
        }

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

  // ── Custom Engine ──
  addCustomEngineBtn.addEventListener('click', () => {
    const name = customEngineName.value.trim();
    const url = customEngineUrl.value.trim();
    const category = customEngineCat.value;

    if (!name) { showToast('Please enter an engine name', true); return; }
    if (!url) { showToast('Please enter a search URL', true); return; }
    if (!url.includes('{searchTerms}')) { showToast('URL must contain {searchTerms} placeholder', true); return; }

    const id = 'custom_' + Date.now();
    const shortcut = name.substring(0, 3).toLowerCase();
    engines.push({
      id, name, url, shortcut, category, enabled: true, custom: true
    });
    customEngineName.value = '';
    customEngineUrl.value = '';
    renderAll();
    showToast('"' + name + '" added successfully');
  });

  // ── Settings ──
  function loadSettings() {
    chrome.runtime.sendMessage({ type: 'getSettings' }, (resp) => {
      if (!resp || !resp.success) return;
      const settings = resp.data;
      settingOpenInNewTab.checked = settings.openInNewTab !== false;
      settingShowContextMenu.checked = settings.showContextMenu !== false;
      settingSelectionToolbar.checked = settings.selectionToolbarEnabled !== false;

      // Populate default engine dropdown
      settingDefaultEngine.innerHTML = '';
      engines.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.name;
        if (e.id === settings.defaultEngine) opt.selected = true;
        settingDefaultEngine.appendChild(opt);
      });

      // Render toolbar engine checkboxes
      renderToolbarEngines(settings.selectionToolbarEngines || []);
    });
  }

  function renderToolbarEngines(selectedIds) {
    toolbarEngineList.innerHTML = '';
    const enabledEngines = engines.filter(e => e.enabled);
    if (enabledEngines.length === 0) {
      toolbarEngineList.innerHTML = '<span style="font-size:12px;color:var(--muted);">No engines enabled. Enable engines above first.</span>';
      return;
    }
    const MAX_TOOLBAR = 6;
    enabledEngines.forEach((engine, idx) => {
      const isChecked = selectedIds.length === 0 ? idx < MAX_TOOLBAR : selectedIds.includes(engine.id);
      const chip = document.createElement('label');
      chip.style.cssText = `
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 10px; border: 1px solid ${isChecked ? 'var(--accent)' : 'var(--rule)'};
        border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;
        background: ${isChecked ? '#eff6ff' : 'var(--input-bg)'};
        color: ${isChecked ? 'var(--accent)' : 'var(--ink)'};
        transition: all 0.15s; user-select: none;
      `;
      chip.innerHTML = `<input type="checkbox" value="${engine.id}" ${isChecked ? 'checked' : ''} style="margin:0;cursor:pointer;"> ${engine.name}`;
      const checkbox = chip.querySelector('input');
      checkbox.addEventListener('change', () => {
        const currentChecked = toolbarEngineList.querySelectorAll('input:checked');
        if (checkbox.checked && currentChecked.length > MAX_TOOLBAR) {
          checkbox.checked = false;
          showToast('Maximum ' + MAX_TOOLBAR + ' engines allowed in toolbar', true);
          return;
        }
        if (checkbox.checked) {
          chip.style.borderColor = 'var(--accent)';
          chip.style.background = '#eff6ff';
          chip.style.color = 'var(--accent)';
        } else {
          chip.style.borderColor = 'var(--rule)';
          chip.style.background = 'var(--input-bg)';
          chip.style.color = 'var(--ink)';
        }
      });
      toolbarEngineList.appendChild(chip);
    });
  }

  settingOpenInNewTab.addEventListener('change', () => autoSaveSettings());
  settingShowContextMenu.addEventListener('change', () => autoSaveSettings());
  settingDefaultEngine.addEventListener('change', () => autoSaveSettings());
  settingSelectionToolbar.addEventListener('change', () => autoSaveSettings());

  async function autoSaveSettings() {
    const settings = {
      openInNewTab: settingOpenInNewTab.checked,
      showContextMenu: settingShowContextMenu.checked,
      defaultEngine: settingDefaultEngine.value,
      selectionToolbarEnabled: settingSelectionToolbar.checked,
      selectionToolbarEngines: getToolbarEngineIds()
    };
    chrome.runtime.sendMessage({ type: 'saveSettings', settings }, () => {
      chrome.runtime.sendMessage({ type: 'rebuildContextMenus' });
    });
  }

  function getToolbarEngineIds() {
    const checked = toolbarEngineList.querySelectorAll('input:checked');
    return Array.from(checked).map(cb => cb.value);
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
      linkedin: 'linkedin', facebook: 'facebook'
    };
    return map[id] ? 'engine-icon ' + map[id] : '';
  }
});