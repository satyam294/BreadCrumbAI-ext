// content.js
console.log('[LeetCode Nudge] content script loaded');

// 1.Fetch problem title

function getProblemTitle() {
  /*
    * Much more reliable than DOM scraping —
    * the URL always looks like /problems/two-sum/
    * so we just pull that slug out directly
  */

  const match = /\/problems\/([^/]+)/.exec(window.location.href);
  if (!match) return 'Unknown Problem';

  // format
  return match[1]
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}


// 2. Selected Language

function getLanguage() {
  // The reference project targets this button by its exact Tailwind classes.
  const button = document.querySelector(
    'button.rounded.items-center.whitespace-nowrap.inline-flex.bg-transparent.dark\\:bg-dark-transparent.text-text-secondary.group'
  );

  if (button && button.textContent) {
    /*
      * The button contains the language text plus a chevron SVG icon.
      * textContent pulls both — we trim and take only the first "word group"
    */
    return button.textContent.trim().split('\n')[0].trim();
  }

  return 'Unknown';
}


// 3. Fetach Code

function getCode() {
  /*
    * Monaco renders line text after loading the container
    * NOTE: Monaco virtual rendering means this only capturescurrently visible lines.
    * Full code extraction via window.monaco API is scheduled for a future version.
  */
  const lineElements = document.querySelectorAll('.view-line');

  if (lineElements.length === 0) return '';

  const lines = Array.from(lineElements).map((lineEl) => {
    return lineEl.textContent.replace(/\u00a0/g, ' ');
  });

  return lines.join('\n');
}


// 4. Scrape and bundle

function scrape() {
  return {
    title: getProblemTitle(),
    language: getLanguage(),
    code: getCode(),
  };
}


// 5. API Configurations

async function callGemini(apiKey, prompt) {
  const GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemma-4-31b-it'
  ];

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.7,
          },
        }),
      });

      // 429 = rate limited on this model, try the next one
      if (response.status === 429) {
        console.log(`[LeetCode Nudge] Gemini model ${model} rate limited, trying next...`);
        continue;
      }

      if (!response.ok) {
        const error = await response.json();
        return `Gemini error: ${error.error?.message || response.statusText}`;
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text
        || 'Could not generate a hint. Try again.';

    } catch (err) {
      console.error(`[LeetCode Nudge] Gemini fetch error on ${model}:`, err);
      continue;
    }
  }

  return 'All Gemini models are rate limited right now. Try again in a minute.';
}

async function callGroq(apiKey, prompt) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return `Groq error: ${error.error?.message || response.statusText}`;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content
      || 'Could not generate a hint. Try again.';

  } catch (err) {
    console.error('[LeetCode Nudge] Groq fetch error:', err);
    return 'Network error — check your connection and try again.';
  }
}


// 6. Calling Api - retrieving results

async function getHint(title, language, code) {
  const result = await chrome.storage.local.get(['apiKey', 'provider']);
  const { apiKey, provider } = result;

  if (!apiKey) {
    return 'No API key found. Click the extension icon to add your API key.';
  }

  // Build the prompt — same for all providers
  const prompt = HINT_PROMPT
    .replace('{{title}}', title)
    .replace('{{language}}', language)
    .replace('{{code}}', code || 'No code written yet.');

  console.log(provider);  //console debug point
  if (provider === 'gemini') return callGemini(apiKey, prompt);
  return callGroq(apiKey, prompt); // default
}


// 7. MutationObserver: Wait for editor to load,, then scrape

function waitForEditor(callback) {
  function check() {
    /*
      * LeetCode is a React app — the editor doesn't exist in the DOM immediately.
      * We use MutationObserver to watch for it to appear, then run our scrape.
    */
    const lines = document.querySelectorAll('.view-line');

    // Wait until .view-line elements exist AND have actual text in them
    const hasContent = Array.from(lines).some(
      (line) => line.textContent.trim().length > 0
    );

    if (hasContent) {
      observer.disconnect();
      callback();
    }
  }

  const observer = new MutationObserver(check);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  //editor already ready
  check();
}


// 8. Entry Point
waitForEditor(() => {
  const data = scrape();
  console.log('[LeetCode Nudge] scraped data:', data);  //console debug point
  createUI(); // inject the button and card into the page
});

