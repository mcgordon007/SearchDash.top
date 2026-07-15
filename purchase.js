/**
 * SearchDash - Purchase Page
 * ================================
 * Handles license activation via Creem
 */

document.addEventListener('DOMContentLoaded', () => {
  const licenseStatus = document.getElementById('licenseStatus');
  const licenseStatusContent = document.getElementById('licenseStatusContent');
  const pricingSection = document.getElementById('pricingSection');
  const licenseKeyInput = document.getElementById('licenseKeyInput');
  const buyBtn = document.getElementById('buyBtn');
  const activateBtn = document.getElementById('activateBtn');
  const deactivateBtn = document.getElementById('deactivateBtn');
  const statusMessage = document.getElementById('statusMessage');
  const keyDisplay = document.getElementById('keyDisplay');
  const keyValue = document.getElementById('keyValue');
  const keyCopyBtn = document.getElementById('keyCopyBtn');

  // Check current license status on load
  loadLicenseStatus();
  // Also load any pending license keys
  loadPendingKeys();

  let pendingCheckoutId = null;

  // Copy button handler
  keyCopyBtn.addEventListener('click', () => {
    const key = keyValue.textContent;
    if (!key) return;

    navigator.clipboard.writeText(key).then(() => {
      keyCopyBtn.textContent = 'Copied!';
      keyCopyBtn.classList.add('copied');
      setTimeout(() => {
        keyCopyBtn.textContent = 'Copy';
        keyCopyBtn.classList.remove('copied');
      }, 2000);
    }).catch(() => {
      // Fallback: select the text
      const range = document.createRange();
      range.selectNode(keyValue);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      keyCopyBtn.textContent = 'Copied!';
      keyCopyBtn.classList.add('copied');
      setTimeout(() => {
        keyCopyBtn.textContent = 'Copy';
        keyCopyBtn.classList.remove('copied');
      }, 2000);
    });
  });

  // Buy button — create checkout via Creem API
  buyBtn.addEventListener('click', () => {
    buyBtn.disabled = true;
    buyBtn.textContent = 'Creating checkout...';

    chrome.runtime.sendMessage({ type: 'createCheckout' }, (response) => {
      if (response && response.success && response.checkoutUrl) {
        // Store the checkout ID for later auto-check
        pendingCheckoutId = response.checkoutId;

        // Show the license key to the user immediately
        if (response.licenseKey) {
          showLicenseKey(response.licenseKey);
        }

        // Open Creem checkout in a new tab
        chrome.tabs.create({ url: response.checkoutUrl }, () => {
          buyBtn.textContent = 'Payment in progress...';
          buyBtn.disabled = true;
          // Show a "Check Payment" hint
          showCheckPaymentHint();
        });
      } else {
        buyBtn.disabled = false;
        buyBtn.textContent = 'Buy Now — $4.99';
        showToast(response?.error || 'Failed to create checkout. Please try again.', 'error');
      }
    });
  });

  /**
   * Show the license key in the key display section
   */
  function showLicenseKey(key) {
    keyValue.textContent = key;
    keyDisplay.style.display = 'block';
    // Auto-fill the activation input
    licenseKeyInput.value = key;
  }

  /**
   * Load any pending license keys from storage
   */
  function loadPendingKeys() {
    chrome.runtime.sendMessage({ type: 'getPendingLicenses' }, (response) => {
      if (!response || !response.success || !response.data) return;

      const pending = response.data;
      const keys = Object.values(pending);
      if (keys.length === 0) return;

      // Show the most recent pending key
      const latest = keys.reduce((a, b) =>
        new Date(a.createdAt) > new Date(b.createdAt) ? a : b
      );
      if (latest && latest.licenseKey) {
        showLicenseKey(latest.licenseKey);
      }
    });
  }

  /**
   * Show a hint to check payment status after payment
   */
  function showCheckPaymentHint() {
    const hint = document.createElement('div');
    hint.id = 'checkPaymentHint';
    hint.style.cssText = 'margin-top: 16px; padding: 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; text-align: center;';
    hint.innerHTML = `
      <p style="font-size: 13px; color: #1e40af; margin-bottom: 10px; font-weight: 500;">
        After completing payment, your license will activate automatically.
      </p>
      <button id="checkPaymentBtn" class="button button-secondary" style="font-size: 12px; padding: 6px 16px;">
        Check Payment Status
      </button>
    `;
    pricingSection.appendChild(hint);

    document.getElementById('checkPaymentBtn').addEventListener('click', () => {
      if (!pendingCheckoutId) {
        showToast('No pending payment found.', 'error');
        return;
      }
      const btn = document.getElementById('checkPaymentBtn');
      btn.disabled = true;
      btn.textContent = 'Checking...';

      chrome.runtime.sendMessage(
        { type: 'checkPayment', checkoutId: pendingCheckoutId },
        (response) => {
          btn.disabled = false;
          btn.textContent = 'Check Payment Status';
          if (response && response.success) {
            showToast('License activated! Pro features unlocked.', 'success');
            loadLicenseStatus();
            const hintEl = document.getElementById('checkPaymentHint');
            if (hintEl) hintEl.remove();
            // Also show the key for reference
            if (response.licenseKey) {
              showLicenseKey(response.licenseKey);
            }
          } else {
            showToast('Payment not yet confirmed. Please try again or enter your license key manually.', 'error');
          }
        }
      );
    });
  }

  // Activate license
  activateBtn.addEventListener('click', async () => {
    const licenseKey = licenseKeyInput.value.trim();
    if (!licenseKey) {
      showToast('Please enter a license key', 'error');
      return;
    }

    activateBtn.disabled = true;
    activateBtn.textContent = 'Activating...';

    chrome.runtime.sendMessage(
      { type: 'activateLicense', licenseKey },
      (response) => {
        activateBtn.disabled = false;
        activateBtn.textContent = 'Activate License';

        if (response && response.success) {
          showToast('License activated! Pro features unlocked.', 'success');
          licenseKeyInput.value = '';
          loadLicenseStatus();
          // Also show the key for reference
          showLicenseKey(licenseKey);
        } else {
          showToast(response?.message || 'Activation failed', 'error');
        }
      }
    );
  });

  // Deactivate license
  deactivateBtn.addEventListener('click', () => {
    if (!confirm('Are you sure you want to remove your license? Pro features will be disabled.')) {
      return;
    }

    chrome.runtime.sendMessage({ type: 'deactivateLicense' }, (response) => {
      if (response && response.success) {
        showToast('License removed', 'success');
        loadLicenseStatus();
      }
    });
  });

  /**
   * Load current license status
   */
  function loadLicenseStatus() {
    chrome.runtime.sendMessage({ type: 'getLicense' }, (response) => {
      if (!response || !response.success) {
        return;
      }

      const license = response.data;

      if (license.activated) {
        // User is Pro
        licenseStatus.style.display = 'block';
        licenseStatusContent.innerHTML = `
          <div class="license-status success">
            <strong>Pro Active</strong> — You have full access to all features.<br>
            Activated: ${new Date(license.activatedAt).toLocaleDateString()}
          </div>
        `;
        pricingSection.style.display = 'none';
        activateBtn.style.display = 'none';
        deactivateBtn.style.display = 'inline-flex';
        // Show the key
        if (license.key) {
          showLicenseKey(license.key);
        }
      } else {
        // Free user
        licenseStatus.style.display = 'none';
        pricingSection.style.display = 'block';
        activateBtn.style.display = 'inline-flex';
        deactivateBtn.style.display = 'none';
      }
    });
  }

  /**
   * Show a toast message
   */
  function showToast(message, type) {
    statusMessage.textContent = message;
    statusMessage.style.background = type === 'error' ? '#ef4444' : '#10b981';
    statusMessage.classList.add('show');
    setTimeout(() => {
      statusMessage.classList.remove('show');
    }, 3000);
  }
});