// Create the Shadow DOM and Design UI

function createUI() {
  /*
    * Create a host element and attach a shadow root to it
    * The host itself is invisible — it's just an anchor point
  */
  const host = document.createElement('div');
  host.id = 'leetcode-nudge-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // shadow root styles: isolated from LeetCode's CSS
  const style = document.createElement('style');
  style.textContent = `
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
    #nudge-btn:hover   { background: #1d4ed8; }
    #nudge-btn:disabled { background: #93c5fd; cursor: not-allowed; }

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
      display: none;
    }
    #nudge-card.visible { display: block; }

    #card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    #card-title {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: #a3a3a3;
      text-transform: uppercase;
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
    #close-btn:hover { color: white; }

    #hint-text {
      color: #d4d4d4;
      line-height: 1.6;
      min-height: 48px;
    }

    /* Dots showing how many hints revealed so far */
    #hint-dots {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #3f3f3f;
      transition: background 0.3s;
    }

    .dot.active   { background: #2563eb; }
    .dot.revealed { background: #60a5fa; }

    /* "Then" button — reveals next hint */
    #next-btn {
      margin-top: 14px;
      width: 100%;
      padding: 7px;
      background: transparent;
      color: #60a5fa;
      border: 1px solid #2563eb;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
      display: none;
    }
    #next-btn:hover   { background: #1e3a5f; }
    #next-btn.visible { display: block; }

    /* Shown while the API call is in flight */
    #loading {
      display: none;
      color: #a3a3a3;
      font-size: 13px;
    }
    #loading.visible { display: block; }

    @keyframes blink {
      0%, 100% { opacity: 0.2; }
      50%       { opacity: 1;   }
    }
    .blink-dot { display: inline-block; animation: blink 1.2s infinite; }
    .blink-dot:nth-child(2) { animation-delay: 0.2s; }
    .blink-dot:nth-child(3) { animation-delay: 0.4s; }
  `;

  const container = document.createElement('div');
  container.innerHTML = `
    <button id="nudge-btn" title="Hungry?">🍞</button>

    <div id="nudge-card">
      <div id="card-header">
        <span id="card-title">Hint <span id="hint-counter">1 of 4</span></span>
        <button id="close-btn">✕</button>
      </div>

      <div id="hint-dots">
        <div class="dot" id="dot-0"></div>
        <div class="dot" id="dot-1"></div>
        <div class="dot" id="dot-2"></div>
        <div class="dot" id="dot-3"></div>
      </div>

      <div id="loading">
        Thinking
        <span class="blink-dot">.</span>
        <span class="blink-dot">.</span>
        <span class="blink-dot">.</span>
      </div>

      <div id="hint-text"></div>

      <button id="next-btn">Still Hungry?</button>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(container);

  // element refs 
  const nudgeBtn    = shadow.getElementById('nudge-btn');
  const nudgeCard   = shadow.getElementById('nudge-card');
  const closeBtn    = shadow.getElementById('close-btn');
  const hintText    = shadow.getElementById('hint-text');
  const loading     = shadow.getElementById('loading');
  const nextBtn     = shadow.getElementById('next-btn');
  const hintCounter = shadow.getElementById('hint-counter');
  const dots        = [0,1,2,3].map(i => shadow.getElementById(`dot-${i}`));

  // state 
  // hints is an array of 4 strings, populated after the API call returns.
  // currentIndex tracks which hint is currently showing.
  let hints        = [];
  let currentIndex = 0;

  // helpers 

  function showHint(index) {
    // hint text
    hintText.textContent = hints[index];

    // counter label
    hintCounter.textContent = `${index + 1} of ${hints.length}`;

    // Update dots:
    dots.forEach((dot, i) => {
      dot.classList.remove('active', 'revealed');
      if (i < index)       dot.classList.add('revealed');
      else if (i === index) dot.classList.add('active');
    });

    // Hide the "More" button on the last hint
    if (index >= hints.length - 1) {
      nextBtn.classList.remove('visible');
    } else {
      nextBtn.classList.add('visible');
    }
  }

  function resetCard() {
    hints        = [];
    currentIndex = 0;
    hintText.textContent = '';
    hintCounter.textContent = '1 of 4';
    nextBtn.classList.remove('visible');
    dots.forEach(d => d.classList.remove('active', 'revealed'));
  }

  // events 

  nudgeBtn.addEventListener('click', async () => {
    const data = scrape();

    // Reset any previous session and show the card
    resetCard();
    nudgeCard.classList.add('visible');
    loading.classList.add('visible');
    nudgeBtn.disabled = true;

    const raw = await getHint(data.title, data.language, data.code);

    loading.classList.remove('visible');
    nudgeBtn.disabled = false;

    // Format API response
    hints = raw
      .split('\n')
      .map(h => h.trim())
      .filter(h => h.length > 0);

    // Fallback if parsing goes wrong
    if (hints.length === 0) {
      hints = [raw];
    }

    currentIndex = 0;
    showHint(0);
  });

  nextBtn.addEventListener('click', () => {
    if (currentIndex < hints.length - 1) {
      currentIndex++;
      showHint(currentIndex);
    }
  });

  closeBtn.addEventListener('click', () => {
    nudgeCard.classList.remove('visible');
    resetCard();
  });
}