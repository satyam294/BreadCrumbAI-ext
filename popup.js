// popup.js
// Runs inside the popup window — completely separate JS context from content.js.
// The only way these two contexts share data is through chrome.storage.

const apiKeyInput = document.getElementById('api-key');
const saveBtn = document.getElementById('save-btn');
const statusEl = document.getElementById('status');

// When the popup opens, load any previously saved key and show it.
chrome.storage.local.get('apiKey', (result) => {
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }
});

// When the user clicks Save, store the key.
saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();

  if (!key) {
    statusEl.textContent = 'Please enter a key.';
    statusEl.style.color = '#dc2626';
    return;
  }

  // chrome.storage.local is like localStorage but:
  // - shared across all extension contexts (popup, content script, background)
  // - persists across browser sessions
  // - async (callback-based or Promise-based)
  chrome.storage.local.set({ apiKey: key }, () => {
    statusEl.textContent = '✓ Saved!';
    statusEl.style.color = '#16a34a';

    // Clear the confirmation after 2 seconds, runs a function in future
    setTimeout(() => {
      statusEl.textContent = '';
    }, 2000);
  });
});