const JOB_CARD_SELECTORS = [
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

function hideListings(namesToBlock, mode) {
  if (!namesToBlock || namesToBlock.length === 0) return;

  const blockedPatterns = namesToBlock.map(name => {
    return new RegExp(escapeRegExp(name), 'i');
  });

  const potentialListings = document.querySelectorAll(JOB_CARD_SELECTORS.join(','));

  let newlyBlockedCount = 0;
  let newOffersText = [];

  potentialListings.forEach(item => {
    if (item.hasAttribute(HIDDEN_ATTR)) return;
    if (item.closest(`[${HIDDEN_ATTR}]`)) return;

    if (item.offsetParent === null) {
      return;
    }
    
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
      const offerTextContent = item.textContent.replace(/\s+/g, ' ').trim().substring(0, 150) + "...";
      newOffersText.push(offerTextContent);
    }
  });

  if (newlyBlockedCount > 0) {
    chrome.storage.local.get(['totalBlockedCount'], (res) => {
      if (chrome.runtime.lastError) return;
      let total = (res.totalBlockedCount || 0) + newlyBlockedCount;
      chrome.storage.local.set({ totalBlockedCount: total });
    });

    chrome.storage.local.get(['blockedOffersLog'], (res) => {
      if (chrome.runtime.lastError) return;
      let log = res.blockedOffersLog || [];
      log = [...newOffersText, ...log].slice(0, 100);
      chrome.storage.local.set({ blockedOffersLog: log });
    });
  }
}

function showAllListings() {
  const hiddenListings = document.querySelectorAll(`[${HIDDEN_ATTR}]`);
  hiddenListings.forEach(item => {
    item.style.display = '';
    item.style.opacity = '';
    item.style.filter = '';
    item.style.pointerEvents = '';
    item.removeAttribute(HIDDEN_ATTR);
  });
}

function updateListingStyles(mode) {
  const hiddenListings = document.querySelectorAll(`[${HIDDEN_ATTR}]`);
  
  hiddenListings.forEach(item => {
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
  const hiddenItems = document.querySelectorAll(`[${HIDDEN_ATTR}]`);
  let count = 0;
  
  hiddenItems.forEach(item => {
    if (!item.parentElement.closest(`[${HIDDEN_ATTR}]`)) {
      count++;
    }
  });

  chrome.runtime.sendMessage({ action: 'updateCount', count: count }, () => {
    if (chrome.runtime.lastError) {}
  });
}

function runFilter(fullReset = false) {
  chrome.storage.local.get(['isEnabled', 'blockedNames', 'blockMode'], result => {
    if (chrome.runtime.lastError) return;
    
    if (fullReset) {
      showAllListings();
    }

    const isEnabled = result.isEnabled === undefined ? true : result.isEnabled;
    const blockMode = result.blockMode || 'hide';
    
    if (isEnabled) {
      hideListings(result.blockedNames, blockMode);
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
  if (chrome.runtime.lastError) return;
  if (namespace !== 'local') return;

  if (changes.isEnabled || changes.blockedNames) {
    runFilter(true);
  } else if (changes.blockMode) {
    chrome.storage.local.get(['isEnabled'], result => {
      if (chrome.runtime.lastError) return;
      const isEnabled = result.isEnabled === undefined ? true : result.isEnabled;
      if (isEnabled) {
        const newMode = changes.blockMode.newValue || 'hide';
        updateListingStyles(newMode);
      }
    });
  }
});