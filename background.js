/**
 * SearchDash - Background Service Worker (Manifest V3)
 * ==========================================================
 * Responsibilities:
 * 1. Initialize default search engines and context menus on install/update
 * 2. Handle context menu clicks, build search URLs, and open results in new tabs
 * 3. Respond to search requests from popup
 * 4. Provide storage read/write for search engine data
 */

// ==================== Default Search Engines ====================
// URL templates use {searchTerms} as the placeholder for search keywords
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

// Storage keys
const STORAGE_KEY_ENGINES = 'engines';
const STORAGE_KEY_SETTINGS = 'settings';
const STORAGE_KEY_LICENSE = 'license';

// Default settings
const DEFAULT_SETTINGS = {
  openInNewTab: true,       // Whether to open search results in a new tab
  showContextMenu: true,     // Whether to show the right-click context menu
  defaultEngine: 'google'    // Default search engine ID
};

// Default license state
const DEFAULT_LICENSE = {
  key: null,
  activated: false,
  activatedAt: null,
  planName: null
};

// Pending checkout mapping: checkoutId → licenseKey
const STORAGE_KEY_PENDING_CHECKOUTS = 'pendingCheckouts';

// Creem API base URL — use test-api for test mode, api for production
const CREEM_API = 'https://test-api.creem.io/v1';
// You need to set these in production (from your Creem dashboard)
const CREEM_API_KEY = 'creem_test_19XjS8tEok5qdFwHvJigyy';
const CREEM_WEBHOOK_SECRET = 'YOUR_CREEM_WEBHOOK_SECRET';
const CREEM_PRODUCT_ID = 'prod_4qJJmMaiTRP0ZafkqLGsR9'; // Pro version product ID from Creem

// Payment success callback URL — hosted on searchdash.top
const SUCCESS_URL = 'https://searchdash.top/success.html';

// ==================== Search Engine Data Management ====================

/**
 * Get search engines from storage
 * Returns default preset if nothing is stored
 * @returns {Promise<Array>} Array of search engines
 */
async function getEngines() {
  const result = await chrome.storage.sync.get(STORAGE_KEY_ENGINES);
  if (result[STORAGE_KEY_ENGINES] && result[STORAGE_KEY_ENGINES].length > 0) {
    return result[STORAGE_KEY_ENGINES];
  }
  // First run: save and return defaults
  await chrome.storage.sync.set({ [STORAGE_KEY_ENGINES]: DEFAULT_ENGINES });
  return DEFAULT_ENGINES;
}

/**
 * Save search engines to storage
 * @param {Array} engines - Array of search engines
 */
async function saveEngines(engines) {
  await chrome.storage.sync.set({ [STORAGE_KEY_ENGINES]: engines });
}

/**
 * Get settings from storage
 * @returns {Promise<Object>} Settings object
 */
async function getSettings() {
  const result = await chrome.storage.sync.get(STORAGE_KEY_SETTINGS);
  if (result[STORAGE_KEY_SETTINGS]) {
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEY_SETTINGS] };
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save settings to storage
 * @param {Object} settings - Settings object
 */
async function saveSettings(settings) {
  await chrome.storage.sync.set({ [STORAGE_KEY_SETTINGS]: settings });
}

// ==================== URL Template Replacement ====================

/**
 * Replace search keyword into URL template
 * @param {string} urlTemplate - URL template containing {searchTerms} placeholder
 * @param {string} query - Search keywords
 * @returns {string} Full URL with query inserted
 */
function buildSearchUrl(urlTemplate, query) {
  const encodedQuery = encodeURIComponent(query);
  return urlTemplate.replace(/\{searchTerms\}/g, encodedQuery);
}

// ==================== Context Menu Management ====================

/**
 * Rebuild all context menus
 * Removes all existing menu items, then recreates based on enabled engines
 * Menu structure:
 *   "Search with SearchDash" (parent, only shown when text is selected)
 *     ├── Google
 *     ├── Bing
 *     ├── ...
 *     └── Open Settings
 */
async function rebuildContextMenus() {
  chrome.contextMenus.removeAll(() => {
    const lastError = chrome.runtime.lastError;
    if (lastError && !lastError.message.includes('Cannot find')) {
      console.warn('Error removing context menus:', lastError);
    }
  });

  const settings = await getSettings();

  if (!settings.showContextMenu) {
    return;
  }

  const engines = await getEngines();
  const enabledEngines = engines.filter(engine => engine.enabled);

  chrome.contextMenus.create({
    id: 'search-switcher-parent',
    title: 'Search with SearchDash',
    contexts: ['selection']
  });

  enabledEngines.forEach((engine, index) => {
    chrome.contextMenus.create({
      id: `search-${engine.id}`,
      parentId: 'search-switcher-parent',
      title: engine.name,
      contexts: ['selection']
    });
  });

  chrome.contextMenus.create({
    id: 'search-switcher-separator',
    parentId: 'search-switcher-parent',
    type: 'separator',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'search-switcher-settings',
    parentId: 'search-switcher-parent',
    title: 'Open Settings',
    contexts: ['selection']
  });
}

/**
 * Handle context menu click events
 * @param {Object} info - Menu click info, includes selectionText
 * @param {Object} tab - Current tab info
 */
async function handleContextMenuClick(info, tab) {
  const menuId = info.menuItemId;

  if (menuId === 'search-switcher-settings') {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (menuId.startsWith('search-')) {
    const engineId = menuId.replace('search-', '');
    const engines = await getEngines();
    const engine = engines.find(e => e.id === engineId);

    if (!engine) {
      console.warn(`Engine not found: ${engineId}`);
      return;
    }

    const query = info.selectionText.trim();
    if (!query) {
      return;
    }

    const searchUrl = buildSearchUrl(engine.url, query);
    const settings = await getSettings();

    if (settings.openInNewTab) {
      chrome.tabs.create({ url: searchUrl, index: tab.index + 1 });
    } else {
      chrome.tabs.update(tab.id, { url: searchUrl });
    }
  }
}

// ==================== License Management ====================

/**
 * Get license info from storage
 * @returns {Promise<Object>} License object
 */
async function getLicense() {
  const result = await chrome.storage.sync.get(STORAGE_KEY_LICENSE);
  if (result[STORAGE_KEY_LICENSE]) {
    return result[STORAGE_KEY_LICENSE];
  }
  return DEFAULT_LICENSE;
}

/**
 * Save license info to storage
 * @param {Object} license - License object
 */
async function saveLicense(license) {
  await chrome.storage.sync.set({ [STORAGE_KEY_LICENSE]: license });
}

/**
 * Check if the user has a valid Pro license
 * @returns {Promise<boolean>}
 */
async function isProUser() {
  const license = await getLicense();
  return license.activated === true;
}

/**
 * Verify a license key with Creem API
 * Calls Creem's license validation endpoint
 * @param {string} licenseKey - The license key to verify
 * @returns {Promise<Object>} Verification result
 */
async function verifyLicenseKey(licenseKey) {
  try {
    const response = await fetch(`${CREEM_API}/licenses/validate`, {
      method: 'POST',
      headers: {
        'x-api-key': CREEM_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: licenseKey,
        instance_id: await getInstanceId()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`License validation failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    return {
      valid: data.status === 'active',
      status: data.status,
      expiresAt: data.expires_at || null,
      planName: 'Pro'
    };
  } catch (error) {
    console.error('License validation error:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * Activate a license key on Creem's server
 * Calls Creem's license activation endpoint
 * @param {string} licenseKey - The license key
 * @returns {Promise<Object>} Activation result
 */
async function activateLicense(licenseKey) {
  try {
    // First, activate the license on Creem's server
    const response = await fetch(`${CREEM_API}/licenses/activate`, {
      method: 'POST',
      headers: {
        'x-api-key': CREEM_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: licenseKey,
        instance_name: 'SearchDash-' + (await getInstanceId()).slice(-8)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`License activation failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (data.status === 'active') {
      await saveLicense({
        key: licenseKey,
        activated: true,
        activatedAt: new Date().toISOString(),
        planName: 'Pro'
      });
      return { success: true, message: 'License activated successfully!' };
    }

    return { success: false, message: `License status: ${data.status}. Please contact support.` };
  } catch (error) {
    console.error('License activation error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Deactivate (remove) the license
 */
async function deactivateLicense() {
  await saveLicense(DEFAULT_LICENSE);
  return { success: true, message: 'License removed.' };
}

/**
 * Get a unique instance ID for this browser
 * Used to prevent license sharing across multiple devices
 * (one license = one device for Creem free tier)
 */
async function getInstanceId() {
  const result = await chrome.storage.local.get('instanceId');
  if (result.instanceId) {
    return result.instanceId;
  }
  const newId = 'inst_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  await chrome.storage.local.set({ instanceId: newId });
  return newId;
}

/**
 * Create a checkout session via Creem API
 * Returns a checkout URL. Also stores the license key (returned at creation time)
 * so it can be auto-activated after payment.
 * @returns {Promise<Object>} Checkout URL or error
 */
async function createCheckout() {
  try {
    const response = await fetch(`${CREEM_API}/checkouts`, {
      method: 'POST',
      headers: {
        'x-api-key': CREEM_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_id: CREEM_PRODUCT_ID,
        success_url: SUCCESS_URL
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Checkout creation failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // Store checkout ID so we can look it up after payment
    // (license key is NOT available at creation — it's generated after payment)
    const pending = await getPendingCheckouts();
    pending[data.id] = {
      createdAt: new Date().toISOString()
    };
    await chrome.storage.sync.set({ [STORAGE_KEY_PENDING_CHECKOUTS]: pending });
    console.log('Stored pending checkout:', data.id);

    return { success: true, checkoutUrl: data.checkout_url, checkoutId: data.id };
  } catch (error) {
    console.error('Checkout creation error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get pending checkout mappings from storage
 * @returns {Promise<Object>} Map of checkoutId → { licenseKey, createdAt }
 */
async function getPendingCheckouts() {
  const result = await chrome.storage.sync.get([STORAGE_KEY_PENDING_CHECKOUTS]);
  return result[STORAGE_KEY_PENDING_CHECKOUTS] || {};
}

/**
 * Fetch checkout details from Creem API after payment
 * License keys are only generated after payment is completed
 * @param {string} checkoutId
 * @returns {Promise<Object|null>} Checkout data or null
 */
async function fetchCheckoutDetails(checkoutId) {
  try {
    const response = await fetch(`${CREEM_API}/checkouts?checkout_id=${encodeURIComponent(checkoutId)}`, {
      method: 'GET',
      headers: {
        'x-api-key': CREEM_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch checkout:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('Checkout details:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error fetching checkout details:', error);
    return null;
  }
}

/**
 * Handle payment success
 * 1. Fetch checkout details from Creem (license key is only available after payment)
 * 2. Activate the license key on Creem (binds to this instance)
 * 3. Save locally
 * @param {Object} params - Payment info from success page
 * @returns {Promise<Object>} Activation result with licenseKey
 */
async function handlePaymentSuccess({ checkoutId, orderId }) {
  if (!checkoutId) {
    return { success: false, licenseKey: null, message: 'Missing checkout ID.' };
  }

  // Fetch checkout details from Creem — license key is only available after payment
  console.log('Fetching checkout details for:', checkoutId);
  const checkout = await fetchCheckoutDetails(checkoutId);

  if (!checkout) {
    return { success: false, licenseKey: null, message: 'Could not fetch order details from Creem. Please try again.' };
  }

  if (checkout.status !== 'completed') {
    return { success: false, licenseKey: null, message: 'Payment not yet completed. Please complete payment first.' };
  }

  // Get the license key from the completed checkout
  const licenseKey = checkout.license_keys && checkout.license_keys.length > 0
    ? checkout.license_keys[0].key
    : null;

  if (!licenseKey) {
    console.error('No license key in completed checkout:', JSON.stringify(checkout));
    return { success: false, licenseKey: null, message: 'No license key found in order. Please check your Creem Dashboard.' };
  }

  console.log('Got license key, activating...');

  // Activate the license on Creem — binds to this browser instance
  const result = await activateLicense(licenseKey);

  if (result.success) {
    // Clean up the pending entry
    const pending = await getPendingCheckouts();
    if (pending[checkoutId]) {
      delete pending[checkoutId];
      await chrome.storage.sync.set({ [STORAGE_KEY_PENDING_CHECKOUTS]: pending });
    }

    return { success: true, licenseKey, message: 'License auto-activated! Pro features unlocked.' };
  }

  return { success: false, licenseKey, message: result.message || 'Activation failed.' };
}

// ==================== Message Handling ====================

/**
 * Handle messages from popup or options page
 * Supported message types:
 *   - createCheckout: Create a Creem checkout session
 *   - search: Execute a search
 *   - getEngines: Get search engine list
 *   - getSettings: Get settings
 *   - updateEngines: Update search engine list
 *   - updateSettings: Update settings
 *   - rebuildMenus: Rebuild context menus
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'createCheckout': {
          const result = await createCheckout();
          sendResponse(result);
          break;
        }

        case 'multiSearch': {
          const { engineIds, query } = message;
          const engines = await getEngines();

          if (!engineIds || engineIds.length === 0) {
            sendResponse({ success: false, error: 'No engines selected' });
            return;
          }

          // Open each selected engine in a new tab
          for (const engineId of engineIds) {
            const engine = engines.find(e => e.id === engineId);
            if (engine) {
              const searchUrl = buildSearchUrl(engine.url, query);
              chrome.tabs.create({ url: searchUrl, active: false });
            }
          }

          sendResponse({ success: true, count: engineIds.length });
          break;
        }

        case 'search': {
          const { engineId, query } = message;
          const engines = await getEngines();
          const engine = engines.find(e => e.id === engineId);

          if (!engine) {
            sendResponse({ success: false, error: `Engine not found: ${engineId}` });
            return;
          }

          const searchUrl = buildSearchUrl(engine.url, query);
          const settings = await getSettings();

          if (settings.openInNewTab) {
            chrome.tabs.create({ url: searchUrl });
          } else {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
              chrome.tabs.update(tab.id, { url: searchUrl });
            } else {
              chrome.tabs.create({ url: searchUrl });
            }
          }

          sendResponse({ success: true });
          break;
        }

        case 'getEngines': {
          const engines = await getEngines();
          sendResponse({ success: true, data: engines });
          break;
        }

        case 'getSettings': {
          const settings = await getSettings();
          sendResponse({ success: true, data: settings });
          break;
        }

        case 'updateEngines': {
          const { engines } = message;
          await saveEngines(engines);
          await rebuildContextMenus();
          sendResponse({ success: true });
          break;
        }

        case 'updateSettings': {
          const { settings } = message;
          await saveSettings(settings);
          await rebuildContextMenus();
          sendResponse({ success: true });
          break;
        }

        case 'rebuildMenus': {
          await rebuildContextMenus();
          sendResponse({ success: true });
          break;
        }

        // --- License & Pro ---
        case 'getLicense': {
          const license = await getLicense();
          sendResponse({ success: true, data: license });
          break;
        }

        case 'isPro': {
          const pro = await isProUser();
          sendResponse({ success: true, data: pro });
          break;
        }

        case 'activateLicense': {
          const { licenseKey } = message;
          const result = await activateLicense(licenseKey);
          sendResponse(result);
          break;
        }

        case 'deactivateLicense': {
          const result = await deactivateLicense();
          sendResponse(result);
          break;
        }

        case 'paymentSuccess': {
          const { checkoutId, orderId, customerId, productId } = message;
          const result = await handlePaymentSuccess({ checkoutId, orderId, customerId, productId });
          sendResponse(result);
          break;
        }

        case 'checkPayment': {
          const { checkoutId } = message;
          const result = await handlePaymentSuccess({ checkoutId });
          sendResponse(result);
          break;
        }

        case 'getPendingLicenses': {
          const pending = await getPendingCheckouts();
          sendResponse({ success: true, data: pending });
          break;
        }

        default: {
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true;
});

// ==================== External Message Handling ====================

/**
 * Handle messages from external web pages (searchdash.top)
 * Used by success.html for auto-activation after Creem payment
 */
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // Only accept messages from our own website
  if (!sender.url || !sender.url.startsWith('https://searchdash.top')) {
    console.warn('Rejected external message from:', sender.url);
    return;
  }

  (async () => {
    try {
      switch (message.type) {
        case 'paymentSuccess': {
          const { checkoutId, orderId, customerId, productId } = message;
          const result = await handlePaymentSuccess({ checkoutId, orderId, customerId, productId });
          sendResponse(result);
          break;
        }

        default: {
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
        }
      }
    } catch (error) {
      console.error('Error handling external message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true;
});

// ==================== Lifecycle Events ====================

/**
 * Triggered on extension install or update
 * Initialize default data and create context menus
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`SearchDash ${details.reason}`);

  if (details.reason === 'install') {
    await saveEngines(DEFAULT_ENGINES);
    await saveSettings(DEFAULT_SETTINGS);
    console.log('Default search engines and settings initialized');
  }

  if (details.reason === 'update') {
    // Reset engines to new defaults on update (new free/pro tier)
    await saveEngines(DEFAULT_ENGINES);
    console.log('Search engines updated to new defaults');
  }

  await rebuildContextMenus();
});

/**
 * Rebuild context menus on browser startup
 * Ensures menus persist after Service Worker wakes up
 */
chrome.runtime.onStartup.addListener(async () => {
  await rebuildContextMenus();
});

// Register context menu click listener
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

console.log('SearchDash Background Service Worker started');