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

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hideListings(namesToBlock, mode, customSelectors = []) {
  if (!namesToBlock || namesToBlock.length === 0) return;

  const allSelectors = [...DEFAULT_JOB_SELECTORS, ...customSelectors];
  const validSelectors = allSelectors.filter(s => s && s.trim().length > 0);
  
  if (validSelectors.length === 0) return;

  const blockedPatterns = namesToBlock.map(name => new RegExp(escapeRegExp(name), 'i'));
  const potentialListings = document.querySelectorAll(validSelectors.join(','));

  let newlyBlockedCount = 0;
  let newOffersText = [];

  potentialListings.forEach(item => {
    if (item.hasAttribute(HIDDEN_ATTR) || item.closest(`[${HIDDEN_ATTR}]`)) return;
    if (item.offsetParent === null) return;

    const itemText = item.textContent;
    if (!itemText) return;

    const isBlocked = blockedPatterns.some(pattern => pattern.test(itemText));

    if (isBlocked) {
      if (mode === 'fade') {
        item.style.opacity = '0.5';
        item.style.filter = 'grayscale(80%)';
        item.style.pointerEvents = 'none';
      } else {
        item.style.display = 'none';
      }

      item.setAttribute(HIDDEN_ATTR, 'true');
      newlyBlockedCount++;
      
      const offerTextContent = itemText.replace(/\s+/g, ' ').trim().substring(0, 150) + "...";
      newOffersText.push(offerTextContent);
    }
  });

  if (newlyBlockedCount > 0) {
    chrome.storage.local.get(['totalBlockedCount', 'blockedOffersLog'], (res) => {
      if (chrome.runtime.lastError) return;
      
      const total = (res.totalBlockedCount || 0) + newlyBlockedCount;
      let log = res.blockedOffersLog || [];
      log = [...newOffersText, ...log].slice(0, 100);
      
      chrome.storage.local.set({ 
        totalBlockedCount: total,
        blockedOffersLog: log 
      });
    });
  }
}

function showAllListings() {
  document.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach(item => {
    item.style.display = '';
    item.style.opacity = '';
    item.style.filter = '';
    item.style.pointerEvents = '';
    item.removeAttribute(HIDDEN_ATTR);
  });
}

function updateListingStyles(mode) {
  document.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach(item => {
    item.style.display = '';
    item.style.opacity = '';
    item.style.filter = '';
    item.style.pointerEvents = '';

    if (mode === 'fade') {
      item.style.opacity = '0.5';
      item.style.filter = 'grayscale(80%)';
      item.style.pointerEvents = 'none';
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

function runFilter(fullReset = false) {
  chrome.storage.sync.get(['isEnabled', 'blockedNames', 'blockMode', 'customSelectors'], result => {
    if (chrome.runtime.lastError) return;

    if (fullReset) {
      showAllListings();
    }

    const isEnabled = result.isEnabled ?? true;
    const blockMode = result.blockMode || 'hide';
    const customSelectors = result.customSelectors || [];

    if (isEnabled) {
      hideListings(result.blockedNames, blockMode, customSelectors);
    } else {
      showAllListings();
    }

    updateBadgeCount();
  });
}

runFilter(true);

let debounceTimer;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runFilter(false), 500);
});

observer.observe(document.body, { childList: true, subtree: true });

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.isEnabled || changes.blockedNames || changes.customSelectors) {
      runFilter(true);
    } else if (changes.blockMode) {
       const newMode = changes.blockMode.newValue || 'hide';
       updateListingStyles(newMode);
    }
  }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'refreshFilters') {
        runFilter(false);
    }
});