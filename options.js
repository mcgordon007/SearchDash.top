/**
 * SearchDash - Options Page Script
 * ======================================
 * Features:
 * 1. View, add, edit, and delete search engines
 * 2. Drag-and-drop reorder search engines
 * 3. Modify general settings
 * 4. Reset to default settings
 */

// Current search engine list (in-memory, saved on explicit save)
let currentEngines = [];
// Current settings
let currentSettings = {};
// Pro status
let isPro = false;

// Free tier limit
const FREE_ENGINE_LIMIT = 5;

// DOM element references
const engineListEl = document.getElementById('engineList');
const addEngineForm = document.getElementById('addEngineForm');
const settingsForm = document.getElementById('settingsForm');
const saveAllBtn = document.getElementById('saveAllBtn');
const resetBtn = document.getElementById('resetBtn');
const statusMessageEl = document.getElementById('statusMessage');

// Default search engines (used when resetting)
const DEFAULT_ENGINES = [
  {
    id: 'google',
    name: 'Google',
    url: 'https://www.google.com/search?q={searchTerms}',
    shortcut: 'g',
    enabled: true
  },
  {
    id: 'bing',
    name: 'Bing',
    url: 'https://www.bing.com/search?q={searchTerms}',
    shortcut: 'b',
    enabled: true
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com/results?search_query={searchTerms}',
    shortcut: 'y',
    enabled: true
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com/search?q={searchTerms}',
    shortcut: 'gh',
    enabled: true
  },
  {
    id: 'stackoverflow',
    name: 'Stack Overflow',
    url: 'https://stackoverflow.com/search?q={searchTerms}',
    shortcut: 'so',
    enabled: true
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    url: 'https://en.wikipedia.org/w/index.php?search={searchTerms}',
    shortcut: 'w',
    enabled: false
  },
  {
    id: 'reddit',
    name: 'Reddit',
    url: 'https://www.reddit.com/search/?q={searchTerms}',
    shortcut: 'r',
    enabled: false
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/?q={searchTerms}',
    shortcut: 'ddg',
    enabled: false
  },
  {
    id: 'amazon',
    name: 'Amazon',
    url: 'https://www.amazon.com/s?k={searchTerms}',
    shortcut: 'a',
    enabled: false
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    url: 'https://x.com/search?q={searchTerms}&src=typed_query',
    shortcut: 'x',
    enabled: false
  }
];

const DEFAULT_SETTINGS = {
  openInNewTab: true,
  showContextMenu: true,
  defaultEngine: 'google'
};

// ==================== Utility Functions ====================

/**
 * Generate a unique ID
 */
function generateId() {
  return 'engine_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

/**
 * Show a status toast message
 */
function showStatus(message) {
  statusMessageEl.textContent = message;
  statusMessageEl.classList.add('show');
  setTimeout(() => {
    statusMessageEl.classList.remove('show');
  }, 2000);
}

// ==================== Render Functions ====================

/**
 * Render the search engine list
 */
function renderEngineList() {
  if (currentEngines.length === 0) {
    engineListEl.innerHTML = '<div class="empty-state">No search engines yet. Add one above.</div>';
    return;
  }

  engineListEl.innerHTML = '';

  currentEngines.forEach((engine, index) => {
    const isLocked = !isPro && index >= FREE_ENGINE_LIMIT;
    const item = document.createElement('div');
    item.className = 'engine-item' + (isLocked ? ' engine-locked' : '');
    item.dataset.index = index;

    // Only allow drag & drop for Pro users
    if (isPro) {
      item.draggable = true;
    }

    const iconClass = `engine-icon ${engine.id}`;
    const iconText = engine.name.charAt(0);

    const dragHandleHtml = isPro
      ? '<span class="drag-handle">⋮⋮</span>'
      : '<span class="drag-handle disabled" title="Upgrade to Pro to reorder">⋮⋮</span>';

    const proBadgeHtml = isLocked
      ? '<span class="pro-badge">🔒 Pro</span>'
      : '';

    item.innerHTML = `
      ${dragHandleHtml}
      <div class="engine-info">
        <span class="${iconClass}">${iconText}</span>
        <div class="engine-details">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="engine-name">${escapeHtml(engine.name)}</span>
            ${engine.shortcut ? `<span class="engine-shortcut">${escapeHtml(engine.shortcut)}</span>` : ''}
            ${proBadgeHtml}
          </div>
          <div class="engine-url">${escapeHtml(engine.url)}</div>
        </div>
      </div>
      <div class="engine-actions">
        <label class="checkbox-group">
          <input type="checkbox" class="engine-enabled" ${engine.enabled ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
          <span style="font-size: 12px;">Enabled</span>
        </label>
        ${isLocked ? '<span class="locked-hint">Unlock with Pro</span>' : '<button class="button button-danger button-sm delete-btn">Delete</button>'}
      </div>
    `;

    // Enable/disable toggle
    const enabledCheckbox = item.querySelector('.engine-enabled');
    if (!isLocked) {
      enabledCheckbox.addEventListener('change', () => {
        engine.enabled = enabledCheckbox.checked;
        updateDefaultEngineOptions();
      });
    }

    // Delete button
    const deleteBtn = item.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        const confirmDelete = confirm(`Are you sure you want to delete "${engine.name}"?`);
        if (confirmDelete) {
          currentEngines.splice(index, 1);
          renderEngineList();
          updateDefaultEngineOptions();
        }
      });
    }

    // Drag-and-drop events (only for Pro)
    if (isPro) {
      item.addEventListener('dragstart', handleDragStart);
      item.addEventListener('dragenter', handleDragEnter);
      item.addEventListener('dragover', handleDragOver);
      item.addEventListener('dragleave', handleDragLeave);
      item.addEventListener('drop', handleDrop);
      item.addEventListener('dragend', handleDragEnd);
    }

    engineListEl.appendChild(item);
  });

  updateDefaultEngineOptions();
  updateProFeatureUI();
}

/**
 * Update the default engine dropdown options
 */
function updateDefaultEngineOptions() {
  const selectEl = document.getElementById('settingDefaultEngine');
  const enabledEngines = currentEngines.filter(e => e.enabled);

  selectEl.innerHTML = '';
  enabledEngines.forEach(engine => {
    const option = document.createElement('option');
    option.value = engine.id;
    option.textContent = engine.name;
    if (engine.id === currentSettings.defaultEngine) {
      option.selected = true;
    }
    selectEl.appendChild(option);
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== Drag-and-Drop Implementation ====================

let dragIndex = null;

function handleDragStart(e) {
  dragIndex = parseInt(this.dataset.index);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragEnter(e) {
  const item = e.currentTarget;
  const enterIndex = parseInt(item.dataset.index);
  if (enterIndex !== dragIndex) {
    item.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
  e.stopPropagation();
  const dropIndex = parseInt(this.dataset.index);

  if (dragIndex !== dropIndex) {
    const dragged = currentEngines[dragIndex];
    currentEngines.splice(dragIndex, 1);
    currentEngines.splice(dropIndex, 0, dragged);
    renderEngineList();
  }

  this.classList.remove('drag-over');
  return false;
}

function handleDragEnd() {
  dragIndex = null;
  document.querySelectorAll('.engine-item').forEach(item => {
    item.classList.remove('drag-over');
  });
}

// ==================== Add Search Engine ====================

addEngineForm.addEventListener('submit', (e) => {
  e.preventDefault();

  // Check free tier limit
  if (!isPro && currentEngines.length >= FREE_ENGINE_LIMIT) {
    alert(`Free version supports up to ${FREE_ENGINE_LIMIT} search engines. Upgrade to Pro for unlimited engines.`);
    return;
  }

  const name = document.getElementById('engineName').value.trim();
  const shortcut = document.getElementById('engineShortcut').value.trim();
  const url = document.getElementById('engineUrl').value.trim();
  const enabled = document.getElementById('engineEnabled').checked;

  if (!name || !url) {
    alert('Name and URL are required.');
    return;
  }

  if (!url.includes('{searchTerms}')) {
    alert('URL must contain the {searchTerms} placeholder.');
    return;
  }

  const newEngine = {
    id: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''),
    name,
    url,
    shortcut,
    enabled
  };

  // If generated ID already exists, append random suffix
  if (currentEngines.some(e => e.id === newEngine.id)) {
    newEngine.id = generateId();
  }

  currentEngines.push(newEngine);
  renderEngineList();
  updateDefaultEngineOptions();

  // Reset form
  addEngineForm.reset();
  document.getElementById('engineEnabled').checked = true;
});

// ==================== Save Settings ====================

saveAllBtn.addEventListener('click', () => {
  const openInNewTab = document.getElementById('settingOpenInNewTab').checked;
  const showContextMenu = document.getElementById('settingShowContextMenu').checked;
  const defaultEngine = document.getElementById('settingDefaultEngine').value;

  const settings = {
    openInNewTab,
    showContextMenu,
    defaultEngine: defaultEngine || (currentEngines[0]?.id || '')
  };

  chrome.runtime.sendMessage({ type: 'updateEngines', engines: currentEngines }, () => {
    chrome.runtime.sendMessage({ type: 'updateSettings', settings }, () => {
      currentSettings = settings;
      showStatus('All settings saved');
    });
  });
});

// ==================== Restore Defaults ====================

resetBtn.addEventListener('click', () => {
  const confirmReset = confirm('Are you sure you want to restore default settings? This will overwrite all your search engine configurations.');
  if (confirmReset) {
    currentEngines = JSON.parse(JSON.stringify(DEFAULT_ENGINES));
    currentSettings = { ...DEFAULT_SETTINGS };
    renderEngineList();
    loadSettingsToForm();
    showStatus('Defaults restored. Click "Save All Settings" to confirm.');
  }
});

// ==================== Load Settings ====================

function loadSettingsToForm() {
  document.getElementById('settingOpenInNewTab').checked = currentSettings.openInNewTab;
  document.getElementById('settingShowContextMenu').checked = currentSettings.showContextMenu;
  updateDefaultEngineOptions();
}

function loadData() {
  chrome.runtime.sendMessage({ type: 'getEngines' }, (engineResponse) => {
    if (engineResponse && engineResponse.success) {
      currentEngines = engineResponse.data;
      renderEngineList();
    } else {
      currentEngines = DEFAULT_ENGINES;
      renderEngineList();
    }

    chrome.runtime.sendMessage({ type: 'getSettings' }, (settingsResponse) => {
      if (settingsResponse && settingsResponse.success) {
        currentSettings = settingsResponse.data;
      } else {
        currentSettings = DEFAULT_SETTINGS;
      }
      loadSettingsToForm();
    });
  });
}

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is Pro
  chrome.runtime.sendMessage({ type: 'isPro' }, (response) => {
    if (response && response.success) {
      isPro = response.data;
      updateProFeatureUI();
    }

    loadData();
  });
});

/**
 * Update UI to reflect Pro/Free state
 */
function updateProFeatureUI() {
  const enabledCount = currentEngines.filter(e => e.enabled).length;
  const addBtn = document.querySelector('#addEngineForm button[type="submit"]');

  if (!isPro) {
    // Update quota display
    let quotaEl = document.getElementById('engineQuota');
    if (!quotaEl) {
      quotaEl = document.createElement('div');
      quotaEl.id = 'engineQuota';
      quotaEl.className = 'quota-bar';
      const sectionTitle = document.querySelector('.section:nth-child(2) .section-title');
      if (sectionTitle) {
        sectionTitle.parentNode.insertBefore(quotaEl, sectionTitle.nextSibling);
      }
    }
    const remaining = Math.max(0, FREE_ENGINE_LIMIT - enabledCount);
    quotaEl.innerHTML = `
      <span class="quota-text">${enabledCount} / ${FREE_ENGINE_LIMIT} engines used</span>
      <a href="#" class="quota-upgrade" id="quotaUpgradeLink">Upgrade to Pro for unlimited →</a>
    `;
    quotaEl.style.display = 'flex';

    // Bind upgrade link
    const upgradeLink = document.getElementById('quotaUpgradeLink');
    if (upgradeLink) {
      upgradeLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: chrome.runtime.getURL('purchase.html') });
      });
    }

    // Disable add button at limit
    if (enabledCount >= FREE_ENGINE_LIMIT) {
      addBtn.type = 'button'; // prevent form submission
      addBtn.textContent = 'Upgrade to Pro to Add More';
      addBtn.classList.add('button-upgrade');
      addBtn.onclick = function(e) {
        e.preventDefault();
        chrome.tabs.create({ url: chrome.runtime.getURL('purchase.html') });
      };
    } else {
      addBtn.type = 'submit';
      addBtn.textContent = 'Add Engine';
      addBtn.classList.remove('button-upgrade');
      addBtn.onclick = null;
    }
  } else {
    // Pro user: hide quota bar, always enable add
    const quotaEl = document.getElementById('engineQuota');
    if (quotaEl) quotaEl.style.display = 'none';
    addBtn.type = 'submit';
    addBtn.textContent = 'Add Engine';
    addBtn.classList.remove('button-upgrade');
    addBtn.onclick = null;
  }
}