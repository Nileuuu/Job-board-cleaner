document.addEventListener('DOMContentLoaded', () => {
  const views = {
    add: document.getElementById('addView'),
    names: document.getElementById('namesView'),
    log: document.getElementById('logView'),
    settings: document.getElementById('settingsView')
  };

  const elements = {
    // Main & Counters
    totalCounter: document.getElementById('totalCounter'),
    newNameInput: document.getElementById('newNameInput'),
    addButton: document.getElementById('addButton'),
    toggleEnabled: document.getElementById('toggleEnabled'),
    statusBadge: document.getElementById('statusBadge'),
    
    // Lists
    blockedNamesList: document.getElementById('blockedNamesList'),
    blockedOffersLog: document.getElementById('blockedOffersLog'),
    
    // Settings
    modeHide: document.getElementById('modeHide'),
    modeFade: document.getElementById('modeFade'),
    exportButton: document.getElementById('exportButton'),
    importButton: document.getElementById('importButton'),
    importFileInput: document.getElementById('importFileInput'),
    
    // Advanced
    newSelectorInput: document.getElementById('newSelectorInput'),
    addSelectorButton: document.getElementById('addSelectorButton'),
    customSelectorsList: document.getElementById('customSelectorsList'),

    // Danger
    clearDataButton: document.getElementById('clearDataButton')
  };

  const navigation = {
    goToNames: document.getElementById('goToNamesButton'),
    goToLog: document.getElementById('goToLogButton'),
    goToSettings: document.getElementById('goToSettingsButton'),
    backFromNames: document.getElementById('backFromNamesButton'),
    backFromLog: document.getElementById('backFromLogButton'),
    backFromSettings: document.getElementById('backFromSettingsButton')
  };

  function showView(viewName) {
    Object.values(views).forEach(view => view.classList.remove('active'));
    views[viewName].classList.add('active');
  }

  navigation.goToNames.addEventListener('click', () => { loadAndRenderNamesList(); showView('names'); });
  navigation.goToLog.addEventListener('click', () => { loadAndRenderLog(); showView('log'); });
  navigation.goToSettings.addEventListener('click', () => { loadCustomSelectors(); showView('settings'); });
  
  [navigation.backFromNames, navigation.backFromLog, navigation.backFromSettings].forEach(btn => 
    btn.addEventListener('click', () => showView('add'))
  );

  function updateStatusUI(isEnabled) {
    elements.toggleEnabled.checked = isEnabled;
    if (isEnabled) {
      elements.statusBadge.textContent = '✅ Actif';
      elements.statusBadge.className = 'status-badge active';
    } else {
      elements.statusBadge.textContent = '❌ Inactif';
      elements.statusBadge.className = 'status-badge inactive';
    }
  }

  chrome.storage.sync.get(['isEnabled', 'blockMode'], (result) => {
    if (chrome.runtime.lastError) return;
    
    const isEnabled = result.isEnabled ?? true;
    updateStatusUI(isEnabled);
    
    const blockMode = result.blockMode || 'hide';
    if (blockMode === 'fade') elements.modeFade.checked = true;
    else elements.modeHide.checked = true;
  });

  elements.toggleEnabled.addEventListener('change', () => {
    const newStatus = elements.toggleEnabled.checked;
    chrome.storage.sync.set({ isEnabled: newStatus }, () => updateStatusUI(newStatus));
  });

  const updateMode = (mode) => chrome.storage.sync.set({ blockMode: mode });
  elements.modeHide.addEventListener('change', () => { if (elements.modeHide.checked) updateMode('hide'); });
  elements.modeFade.addEventListener('change', () => { if (elements.modeFade.checked) updateMode('fade'); });

  function loadAndRenderNamesList() {
    chrome.storage.sync.get(['blockedNames'], (result) => {
      if (!chrome.runtime.lastError) renderList(result.blockedNames || [], elements.blockedNamesList, deleteName);
    });
  }

  function addName() {
    const val = elements.newNameInput.value.trim();
    if (!val) return;
    chrome.storage.sync.get(['blockedNames'], (result) => {
      const names = result.blockedNames || [];
      if (!names.some(n => n.toLowerCase() === val.toLowerCase())) {
        names.push(val);
        saveNames(names);
      }
      elements.newNameInput.value = '';
    });
  }

  function deleteName(val) {
    chrome.storage.sync.get(['blockedNames'], (result) => {
      const names = (result.blockedNames || []).filter(n => n !== val);
      saveNames(names);
    });
  }

  function saveNames(names) {
    names.sort((a, b) => a.localeCompare(b));
    chrome.storage.sync.set({ blockedNames: names }, () => loadAndRenderNamesList());
  }

  function loadTotalCounter() {
    chrome.storage.local.get(['totalBlockedCount'], (result) => {
      if (!chrome.runtime.lastError) elements.totalCounter.textContent = String(result.totalBlockedCount || 0);
    });
  }

  function loadAndRenderLog() {
    chrome.storage.local.get(['blockedOffersLog'], (result) => {
      const log = result.blockedOffersLog || [];
      elements.blockedOffersLog.innerHTML = '';
      if (log.length === 0) {
        elements.blockedOffersLog.innerHTML = '<li class="empty-state">Aucune offre masquée.</li>';
        return;
      }
      const fragment = document.createDocumentFragment();
      log.forEach(txt => {
        const li = document.createElement('li');
        li.textContent = txt;
        fragment.appendChild(li);
      });
      elements.blockedOffersLog.appendChild(fragment);
    });
  }

  function loadCustomSelectors() {
    chrome.storage.sync.get(['customSelectors'], (result) => {
       renderList(result.customSelectors || [], elements.customSelectorsList, deleteSelector);
    });
  }

  function addSelector() {
    const val = elements.newSelectorInput.value.trim();
    if (!val) return;
    chrome.storage.sync.get(['customSelectors'], (result) => {
      const sels = result.customSelectors || [];
      if (!sels.includes(val)) {
        sels.push(val);
        chrome.storage.sync.set({ customSelectors: sels }, () => {
            loadCustomSelectors();
            elements.newSelectorInput.value = '';
        });
      }
    });
  }

  function deleteSelector(val) {
    chrome.storage.sync.get(['customSelectors'], (result) => {
      const sels = (result.customSelectors || []).filter(s => s !== val);
      chrome.storage.sync.set({ customSelectors: sels }, loadCustomSelectors);
    });
  }

  function renderList(items, container, deleteCallback) {
    container.innerHTML = '';
    if (items.length === 0) {
      container.innerHTML = '<li class="empty-state">Rien ici.</li>';
      return;
    }
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = item;
      li.appendChild(span);
      const btn = document.createElement('button');
      btn.textContent = '×';
      btn.className = 'delete-btn';
      btn.onclick = () => deleteCallback(item);
      li.appendChild(btn);
      fragment.appendChild(li);
    });
    container.appendChild(fragment);
  }

  elements.exportButton.addEventListener('click', () => {
    chrome.storage.sync.get(null, (syncData) => {
      const exportData = {
        version: 1,
        timestamp: new Date().toISOString(),
        settings: syncData
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {type : 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'job-board-cleaner-config.json';
      a.click();
    });
  });

  elements.importButton.addEventListener('click', () => elements.importFileInput.click());

  elements.importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.settings) {
          if (confirm(`Importer la configuration du ${new Date(data.timestamp).toLocaleDateString()} ?\nCela remplacera vos réglages actuels.`)) {
            chrome.storage.sync.set(data.settings, () => {
              alert("Configuration importée avec succès !");
              window.location.reload();
            });
          }
        } else {
          alert("Format de fichier invalide.");
        }
      } catch (err) {
        alert("Erreur lors de la lecture du fichier.");
      }
    };
    reader.readAsText(file);
  });

  elements.clearDataButton.addEventListener('click', () => {
    if (confirm("Tout effacer (Mots bloqués, réglages, logs) ?")) {
      chrome.storage.sync.clear(() => {
        chrome.storage.local.clear(() => window.location.reload());
      });
    }
  });

  loadTotalCounter();
  elements.addButton.addEventListener('click', addName);
  elements.newNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addName(); });
  elements.addSelectorButton.addEventListener('click', addSelector);
  elements.newSelectorInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addSelector(); });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.totalBlockedCount) loadTotalCounter();
  });
});