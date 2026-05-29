// content.js
// This file is injected by Chrome into every LeetCode problem page.
// It runs in an isolated JS context — it can read/modify the DOM,
// but it cannot access the page's own JS variables.

// content.js

console.log('[LeetCode Nudge] content script loaded');

// ─── 1. GET PROBLEM TITLE ────────────────────────────────────────────────────

function getProblemTitle() {
  // Much more reliable than DOM scraping —
  // the URL always looks like /problems/two-sum/
  // so we just pull that slug out directly
  const match = /\/problems\/([^/]+)/.exec(window.location.href);
  if (!match) return 'Unknown Problem';

  // Convert "two-sum" → "Two Sum"
  return match[1]
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ─── 2. GET SELECTED LANGUAGE ────────────────────────────────────────────────

function getLanguage() {
  // The reference project targets this button by its exact Tailwind classes.
  // This is more precise than looping all buttons — it matches the exact
  // element LeetCode uses for the language selector.
  const button = document.querySelector(
    'button.rounded.items-center.whitespace-nowrap.inline-flex.bg-transparent.dark\\:bg-dark-transparent.text-text-secondary.group'
  );

  if (button && button.textContent) {
    // The button contains the language text plus a chevron SVG icon.
    // textContent pulls both — we trim and take only the first "word group"
    // to strip the icon's invisible text.
    return button.textContent.trim().split('\n')[0].trim();
  }

  return 'Unknown';
}

// ─── 3. GET USER CODE ────────────────────────────────────────────────────────

function getCode() {
  
  // Monaco renders line text after loading the container

  // NOTE: Monaco virtual rendering means this only captures
  // currently visible lines. Full code extraction via window.monaco API is scheduled for a future version.

  const lineElements = document.querySelectorAll('.view-line');

  if (lineElements.length === 0) return '';

  const lines = Array.from(lineElements).map((lineEl) => {
    return lineEl.textContent.replace(/\u00a0/g, ' ');
  });

  return lines.join('\n');
}
// ─── 4. SCRAPE EVERYTHING ────────────────────────────────────────────────────

function scrape() {
  return {
    title: getProblemTitle(),
    language: getLanguage(),
    code: getCode(),
  };
}

// ─── 5. UI ──────────────────────────────────────────────────────────────────────

function createUI() {
  // 1. Create a host element and attach a shadow root to it
  //    The host itself is invisible — it's just an anchor point
  const host = document.createElement('div');
  host.id = 'leetcode-nudge-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // 2. Inject styles into the shadow root
  //    These are completely isolated from LeetCode's CSS
  const style = document.createElement('style');
  style.textContent = `
    /* Floating trigger button */
    #nudge-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #2563eb;
      color: white;
      border: none;
      font-size: 22px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    #nudge-btn:hover {
      background: #1d4ed8;
    }

    /* Hint card */
    #nudge-card {
      position: fixed;
      bottom: 84px;
      right: 24px;
      z-index: 9999;
      width: 300px;
      background: #1e1e1e;
      color: #d4d4d4;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      font-family: sans-serif;
      font-size: 14px;
      line-height: 1.6;

      /* Hidden by default */
      display: none;
    }

    #nudge-card.visible {
      display: block;
    }

    /* Card header row */
    #card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    #card-title {
      font-size: 13px;
      font-weight: 600;
      color: #a3a3a3;
    }

    #close-btn {
      background: none;
      border: none;
      color: #a3a3a3;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }

    #close-btn:hover {
      color: white;
    }

    /* Hint text area */
    #hint-text {
      color: #d4d4d4;
    }
  `;

  // 3. Build the HTML structure
  const container = document.createElement('div');
  container.innerHTML = `
    <button id="nudge-btn" title="Get a hint">💡</button>

    <div id="nudge-card">
      <div id="card-header">
        <span id="card-title">HINT</span>
        <button id="close-btn">✕</button>
      </div>
      <div id="hint-text">
        Click the button below to get a nudge for this problem.
      </div>
    </div>
  `;

  // 4. Attach styles and content to the shadow root
  shadow.appendChild(style);
  shadow.appendChild(container);

  // 5. Wire up interactions
  const nudgeBtn = shadow.getElementById('nudge-btn');
  const nudgeCard = shadow.getElementById('nudge-card');
  const closeBtn = shadow.getElementById('close-btn');
  const hintText = shadow.getElementById('hint-text');

  // Toggle card visibility when the button is clicked
  nudgeBtn.addEventListener('click', () => {
    const data = scrape();
    console.log('[LeetCode Nudge] scrape on click:', data);

    // For now just show the card with placeholder text
    // Layer 4 will replace this with a real AI call
    hintText.textContent = `Problem: ${data.title} — AI hint coming in Layer 4!`;
    nudgeCard.classList.add('visible');
  });

  // Close the card
  closeBtn.addEventListener('click', () => {
    nudgeCard.classList.remove('visible');
  });
}

// ─── 6. WAIT FOR THE EDITOR TO LOAD, THEN SCRAPE ────────────────────────────

// LeetCode is a React app — the editor doesn't exist in the DOM immediately.
// We use MutationObserver to watch for it to appear, then run our scrape.

function waitForEditor(callback) {
  function check() {
    const lines = document.querySelectorAll('.view-line');

    // Wait until .view-line elements exist AND have actual text in them
    // This is the key difference — existence alone isn't enough
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
  // Run once immediately in case editor is already ready
  check();
}

// Entry point
waitForEditor(() => {
  const data = scrape();
  console.log('[LeetCode Nudge] scraped data:', data);
  createUI(); // inject the button and card into the page
});

/*
#title
<a class="no-underline hover:text-blue-s dark:hover:text-dark-blue-s truncate cursor-text whitespace-normal hover:
!text-[inherit]" href="/problems/minimum-element-after-replacement-with-digit-sum/">3300. Minimum Element After
Replacement With Digit Sum</a>

#language
<button type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="radix-_r_2e_" data-state="closed" class="rounded items-center whitespace-nowrap focus:outline-none inline-flex bg-transparent dark:bg-dark-transparent text-text-secondary dark:text-text-secondary active:bg-transparent dark:active:bg-dark-transparent hover:bg-fill-secondary dark:hover:bg-fill-secondary h-full px-1.5 py-0.5 text-sm font-normal group">Java<div class="relative text-[12px] leading-[normal] p-0.5 before:block before:h-3 before:w-3 ml-1 text-gray-60 dark:text-gray-60"><svg aria-hidden="true" focusable="false" data-prefix="far" data-icon="chevron-down" class="svg-inline--fa fa-chevron-down absolute h-[1em] -translate-x-1/2 -translate-y-1/2 align-[-0.125em] left-1/2 top-1/2" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M239 401c9.4 9.4 24.6 9.4 33.9 0L465 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-175 175L81 175c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9L239 401z"></path></svg></div></button>

#code
<div class="view-lines monaco-mouse-cursor-text" role="presentation" aria-hidden="true" data-mprt="8" style="position: absolute; font-family: Consolas, &quot;Courier New&quot;, monospace; font-weight: normal; font-size: 13px; font-feature-settings: &quot;liga&quot; 0, &quot;calt&quot; 0; font-variation-settings: normal; line-height: 18px; letter-spacing: 0px; width: 787px; height: 340px;"><div style="top:8px;height:18px;line-height:18px;" class="view-line"><span><span class="mtk4">class</span><span class="mtk1">&nbsp;</span><span class="mtk10">Solution</span><span class="mtk1">&nbsp;{</span></span></div><div style="top:26px;height:18px;line-height:18px;" class="view-line"><span><span class="mtk1">&nbsp;&nbsp;&nbsp;&nbsp;</span><span class="mtk4">public</span><span class="mtk1">&nbsp;</span><span class="mtk10">int</span><span class="mtk1">&nbsp;</span><span class="mtk11">minElement</span><span class="mtk1">(</span><span class="mtk10">int</span><span class="mtk1">[]&nbsp;</span><span class="mtk14">nums</span><span class="mtk1">)&nbsp;{</span></span></div><div style="top:44px;height:18px;line-height:18px;" class="view-line"><span><span class="mtk1">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span class="mtk10">int</span><span class="mtk1">&nbsp;</span><span class="mtk14">min</span><span class="mtk1">&nbsp;=&nbsp;</span><span class="mtk7">50</span><span class="mtk1">;</span></span></div><div style="top:62px;height:18px;line-height:18px;" class="view-line"><span><span class="mtk1">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span class="mtk13">for</span><span class="mtk1">(</span><span class="mtk10">int</span><span class="mtk1">&nbsp;</span><span class="mtk14">num</span><span class="mtk13">:</span><span class="mtk1">&nbsp;nums){</span></span></div><div style="top:80px;height:18px;line-height:18px;" class="view-line"><span><span class="mtk1">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span class="mtk10">int</span><span class="mtk1">&nbsp;</span><span class="mtk14">digSum</span><span class="mtk1">&nbsp;=&nbsp;</span><span class="mtk7">0</span><span class="mtk1">;</span></span></div></div>

let programmingLanguage = 'UNKNOWN'

    const changeLanguageButton = document.querySelector(
      'button.rounded.items-center.whitespace-nowrap.inline-flex.bg-transparent.dark\\:bg-dark-transparent.text-text-secondary.group'
    )
    if (changeLanguageButton) {
      if (changeLanguageButton.textContent)
        programmingLanguage = changeLanguageButton.textContent
    }
*/