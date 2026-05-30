/*
  * popup.js
  * Runs inside the popup window — completely separate JS context from content.js.
  * The only way these two contexts share data is through chrome.storage.
*/

const apiKeyInput   = document.getElementById('api-key');
const saveBtn       = document.getElementById('save-btn');
const statusEl      = document.getElementById('status');
const providerSelect = document.getElementById('provider');

// restore both saved values, if available
chrome.storage.local.get(['apiKey', 'provider'], (result) => {
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }
  if (result.provider) {
    providerSelect.value = result.provider;
  }
});

saveBtn.addEventListener('click', () => {
  const key      = apiKeyInput.value.trim();
  const provider = providerSelect.value;

  if (!key) {
    statusEl.textContent = 'Please enter a key.';
    statusEl.style.color = '#dc2626';
    return;
  }

  // save chosen key and provider
  chrome.storage.local.set({ apiKey: key, provider }, () => {
    statusEl.textContent = '✓ Saved!';
    statusEl.style.color = '#16a34a';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  });
});