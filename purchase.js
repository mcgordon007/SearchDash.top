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

  // Check current license status on load
  loadLicenseStatus();

  let pendingCheckoutId = null;

  // Buy button — create checkout via Creem API
  buyBtn.addEventListener('click', () => {
    buyBtn.disabled = true;
    buyBtn.textContent = 'Creating checkout...';

    chrome.runtime.sendMessage({ type: 'createCheckout' }, (response) => {
      if (response && response.success && response.checkoutUrl) {
        // Store the checkout ID for later auto-check
        pendingCheckoutId = response.checkoutId;
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