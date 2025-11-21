chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "blockSelection",
    title: chrome.i18n.getMessage("contextMenuBlock"),
    contexts: ["selection"]
  });
  chrome.action.setBadgeBackgroundColor({ color: '#d11a2a' });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "blockSelection" && info.selectionText) {
    const text = info.selectionText.trim();
    if (!text) return;

    chrome.storage.sync.get(['blockedNames'], res => {
      const blocked = res.blockedNames || [];
      if (!blocked.includes(text)) {
        blocked.push(text);
        chrome.storage.sync.set({ blockedNames: blocked }, () => {
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { action: 'refreshFilters' }).catch(() => {});
          }
        });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "updateCount") {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.action.setBadgeText({
        text: message.count > 0 ? String(message.count) : "",
        tabId
      });
    }
  }
});