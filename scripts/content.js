const DEFAULT_JOB_SELECTORS = [
  '[data-id-storage-target]',
  '.job_seen_beacon',
  '[data-testid="slider_item"]',
  '[data-tracking-control-name="public_jobs_jserp-result_search-card"]',
  '.jobs-search-results__list-item',
  '.base-card',
  'article[data-testid*="job-card"]',
  '.card-container',
  '.job-card',
  '.job-list-item',
  '.job-listing',
  '.search-card',
  '.card-offer',
  '[data-testid="search-results-list-item-wrapper"]'
];

const HIDDEN_ATTR = 'data-job-cleaner-hidden';

function cleanItem(item) {
  item.style.display = '';
  item.style.opacity = '';
  item.style.filter = '';
  item.style.pointerEvents = '';
  item.removeAttribute(HIDDEN_ATTR);
  item.removeAttribute('title'); // Nettoyage du tooltip
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hideListings(namesToBlock, mode, customSelectors = []) {
  if (!namesToBlock || namesToBlock.length === 0) {
    showAllListings();
    return;
  }

  const allSelectors = [...DEFAULT_JOB_SELECTORS, ...customSelectors];
  const validSelectors = allSelectors.filter(s => s && s.trim().length > 0);
  
  if (validSelectors.length === 0) return;

  // On prépare les regex
  const blockedPatterns = namesToBlock.map(name => new RegExp(escapeRegExp(name), 'i'));
  const potentialListings = document.querySelectorAll(validSelectors.join(','));

  let newlyBlockedCount = 0;
  let newOffersText = [];

  potentialListings.forEach(item => {
    if (item.hasAttribute(HIDDEN_ATTR)) return;
    if (item.closest(`[${HIDDEN_ATTR}]`)) return;
    if (item.offsetParent === null) return;

    const itemText = item.textContent; 
    if (!itemText) return;

    // Recherche du mot déclencheur spécifique (pour le tooltip)
    let foundKeyword = null;
    for (let i = 0; i < blockedPatterns.length; i++) {
      if (blockedPatterns[i].test(itemText)) {
        foundKeyword = namesToBlock[i];
        break;
      }
    }

    if (foundKeyword) {
      if (mode === 'fade') {
        item.style.opacity = '0.5';
        item.style.filter = 'grayscale(100%)';
        item.style.pointerEvents = 'none';
        // UX Improvement: Tooltip "Why?"
        const msg = chrome.i18n.getMessage("tooltipBlocked", foundKeyword) || `Blocked: ${foundKeyword}`;
        item.setAttribute('title', msg);
      } else {
        item.style.display = 'none';
      }

      item.setAttribute(HIDDEN_ATTR, 'true');
      newlyBlockedCount++;
      
      const cleanText = itemText.replace(/\s+/g, ' ').trim().substring(0, 100);
      newOffersText.push(cleanText);
    }
  });

  if (newlyBlockedCount > 0) {
    chrome.storage.local.get(['totalBlockedCount', 'blockedOffersLog'], (res) => {
      if (chrome.runtime.lastError) return;
      const total = (res.totalBlockedCount || 0) + newlyBlockedCount;
      let log = res.blockedOffersLog || [];
      log = [...newOffersText, ...log].slice(0, 100);
      chrome.storage.local.set({ totalBlockedCount: total, blockedOffersLog: log });
    });
  }
}

function showAllListings() {
  const hiddenItems = document.querySelectorAll(`[${HIDDEN_ATTR}]`);
  hiddenItems.forEach(cleanItem);
}

function updateListingStyles(mode) {
  const hiddenItems = document.querySelectorAll(`[${HIDDEN_ATTR}]`);
  hiddenItems.forEach(item => {
    item.style.display = '';
    item.style.opacity = '';
    item.style.filter = '';
    item.style.pointerEvents = '';
    
    if (mode === 'fade') {
      item.style.opacity = '0.5';
      item.style.filter = 'grayscale(100%)';
      item.style.pointerEvents = 'none';
      // On conserve le title existant s'il y en a un
    } else {
      item.style.display = 'none';
    }
  });
}

function updateBadgeCount() {
  let count = 0;
  document.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach(item => {
    if (!item.parentElement.closest(`[${HIDDEN_ATTR}]`)) {
      count++;
    }
  });
  chrome.runtime.sendMessage({ action: 'updateCount', count: count }).catch(() => {});
}

function runFilter(fullReset = false, dataOverride = null) {
  const process = (data) => {
    const isEnabled = data.isEnabled ?? true;
    const blockMode = data.blockMode || 'hide';
    const customSelectors = data.customSelectors || [];
    const blockedNames = data.blockedNames || [];

    if (fullReset) showAllListings();

    if (isEnabled) {
      hideListings(blockedNames, blockMode, customSelectors);
    } else {
      showAllListings();
    }
    updateBadgeCount();
  };

  if (dataOverride) {
    process(dataOverride);
  } else {
    chrome.storage.sync.get(['isEnabled', 'blockedNames', 'blockMode', 'customSelectors'], (result) => {
      if (chrome.runtime.lastError) return;
      process(result);
    });
  }
}

runFilter(true);

let debounceTimer;
let observer;
let isProcessing = false;

function handleMutation(mutations) {
  const isRelevant = mutations.some(m => 
    m.type === 'childList' || 
    (m.type === 'attributes' && m.attributeName !== HIDDEN_ATTR && m.attributeName !== 'style' && m.attributeName !== 'title')
  );

  if (!isRelevant) return;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (isProcessing) return;
    isProcessing = true;
    runFilter(false);
    setTimeout(() => { isProcessing = false; }, 100);
  }, 300);
}

function startObserver() {
  if (!observer) {
    observer = new MutationObserver(handleMutation);
  }
  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'id'] 
  });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

if (!document.hidden) startObserver();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopObserver();
  } else {
    startObserver();
    runFilter(false);
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.isEnabled || changes.blockedNames || changes.customSelectors) {
      chrome.storage.sync.get(['isEnabled', 'blockedNames', 'blockMode', 'customSelectors'], (newData) => {
         runFilter(true, newData); 
      });
    } else if (changes.blockMode) {
       const newMode = changes.blockMode.newValue || 'hide';
       updateListingStyles(newMode);
    }
  }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'refreshFilters') runFilter(true);
});