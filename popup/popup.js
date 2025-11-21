document.addEventListener('DOMContentLoaded', () => {
  const addView = document.getElementById('addView');
  const namesView = document.getElementById('namesView');
  const logView = document.getElementById('logView');
  const settingsView = document.getElementById('settingsView');

  const totalCounter = document.getElementById('totalCounter');

  const blockedNamesListContainer = document.getElementById('blockedNamesList');
  const blockedOffersLogContainer = document.getElementById('blockedOffersLog');

  const goToNamesButton = document.getElementById('goToNamesButton');
  const goToLogButton = document.getElementById('goToLogButton');
  const backFromNamesButton = document.getElementById('backFromNamesButton');
  const backFromLogButton = document.getElementById('backFromLogButton');
  const goToSettingsButton = document.getElementById('goToSettingsButton');
  const backFromSettingsButton = document.getElementById('backFromSettingsButton');

  const newNameInput = document.getElementById('newNameInput');
  const addButton = document.getElementById('addButton');
  
  const toggleEnabled = document.getElementById('toggleEnabled');
  const statusBadge = document.getElementById('statusBadge');
  const modeHide = document.getElementById('modeHide');
  const modeFade = document.getElementById('modeFade');
  const clearDataButton = document.getElementById('clearDataButton');

  function showView(viewToShow) {
    [addView, namesView, logView, settingsView].forEach(view => {
      view.classList.remove('active');
    });
    viewToShow.classList.add('active');
  }

  goToNamesButton.addEventListener('click', () => {
    loadAndRenderNamesList(); 
    showView(namesView);
  });
  goToLogButton.addEventListener('click', () => {
    loadAndRenderLog(); 
    showView(logView);
  });
  goToSettingsButton.addEventListener('click', () => showView(settingsView));
  
  backFromNamesButton.addEventListener('click', () => showView(addView));
  backFromLogButton.addEventListener('click', () => showView(addView));
  backFromSettingsButton.addEventListener('click', () => showView(addView));


  function updateStatusUI(isEnabled) {
    toggleEnabled.checked = isEnabled;
    if (isEnabled) {
      statusBadge.textContent = '✅ Actif';
      statusBadge.classList.add('active');
      statusBadge.classList.remove('inactive');
    } else {
      statusBadge.textContent = '❌ Inactif';
      statusBadge.classList.add('inactive');
      statusBadge.classList.remove('active');
    }
  }

  chrome.storage.local.get(['isEnabled', 'blockMode'], (result) => {
    if (chrome.runtime.lastError) { return; }
    
    const isEnabled = (result.isEnabled === undefined) ? true : result.isEnabled;
    updateStatusUI(isEnabled);
    
    const blockMode = result.blockMode || 'hide';
    if (blockMode === 'fade') {
      modeFade.checked = true;
    } else {
      modeHide.checked = true;
    }
  });

  toggleEnabled.addEventListener('change', () => {
    const newStatus = toggleEnabled.checked;
    chrome.storage.local.set({ isEnabled: newStatus }, () => {
      if (chrome.runtime.lastError) { return; }
      updateStatusUI(newStatus);
    });
  });

  modeHide.addEventListener('change', () => {
    if (modeHide.checked) {
      chrome.storage.local.set({ blockMode: 'hide' }, () => {
        if (chrome.runtime.lastError) { return; }
      });
    }
  });
  modeFade.addEventListener('change', () => {
    if (modeFade.checked) {
      chrome.storage.local.set({ blockMode: 'fade' }, () => {
        if (chrome.runtime.lastError) { return; }
      });
    }
  });
  
  clearDataButton.addEventListener('click', () => {
    if (confirm("Êtes-vous sûr de vouloir tout réinitialiser ?\nCette action est irréversible.")) {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) { return; }
        window.location.reload();
      });
    }
  });


  function loadTotalCounter() {
    chrome.storage.local.get(['totalBlockedCount'], (result) => {
      if (chrome.runtime.lastError) { return; }
      totalCounter.textContent = String(result.totalBlockedCount || 0);
    });
  }

  function loadAndRenderNamesList() {
    chrome.storage.local.get(['blockedNames'], (result) => {
      if (chrome.runtime.lastError) { return; }
      const names = result.blockedNames || [];
      renderNamesList(names);
    });
  }

  function renderNamesList(names) {
    blockedNamesListContainer.innerHTML = '';
    if (names.length === 0) {
      blockedNamesListContainer.innerHTML = '<li class="empty-state">Aucun mot bloqué.</li>';
      return;
    }
    names.forEach(name => {
      const li = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = name;
      li.appendChild(nameSpan);
      const deleteButton = document.createElement('button');
      deleteButton.textContent = '×';
      deleteButton.className = 'delete-btn';
      deleteButton.title = `Supprimer "${name}"`;
      deleteButton.addEventListener('click', () => deleteName(name));
      li.appendChild(deleteButton);
      blockedNamesListContainer.appendChild(li);
    });
  }

  function addName() {
    const nameToAdd = newNameInput.value.trim();
    if (!nameToAdd) return; 
    chrome.storage.local.get(['blockedNames'], (result) => {
      if (chrome.runtime.lastError) { return; }
      const names = result.blockedNames || [];
      const lowerCaseNames = names.map(n => n.toLowerCase());
      if (!lowerCaseNames.includes(nameToAdd.toLowerCase())) {
        names.push(nameToAdd);
        saveNamesList(names);
      }
      newNameInput.value = '';
    });
  }

  function deleteName(nameToDelete) {
    chrome.storage.local.get(['blockedNames'], (result) => {
      if (chrome.runtime.lastError) { return; }
      let names = result.blockedNames || [];
      names = names.filter(name => name !== nameToDelete);
      saveNamesList(names);
    });
  }

  function saveNamesList(names) {
    names.sort((a, b) => a.localeCompare(b));
    chrome.storage.local.set({ blockedNames: names }, () => {
      if (chrome.runtime.lastError) { return; }
      renderNamesList(names); 
    });
  }

  function loadAndRenderLog() {
    chrome.storage.local.get(['blockedOffersLog'], (result) => {
      if (chrome.runtime.lastError) { return; }
      const log = result.blockedOffersLog || [];
      blockedOffersLogContainer.innerHTML = '';
      if (log.length === 0) {
        blockedOffersLogContainer.innerHTML = '<li class="empty-state">Aucune offre masquée.</li>';
        return;
      }
      log.forEach(offerText => {
        const li = document.createElement('li');
        li.textContent = offerText;
        blockedOffersLogContainer.appendChild(li);
      });
    });
  }

  loadTotalCounter(); 
  addButton.addEventListener('click', addName);
  newNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addName();
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.totalBlockedCount) {
      loadTotalCounter();
    }
  });
  
});