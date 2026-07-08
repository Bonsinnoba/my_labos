// Renderer process JavaScript

const appFrame = document.getElementById('app-frame');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const syncIndicator = document.getElementById('sync-indicator');
const syncText = document.getElementById('sync-text');
const restartButton = document.getElementById('restart-python');

let wasSyncing = false;

// Initialize
async function init() {
  try {
    const version = await window.electronAPI.getAppVersion();
    document.getElementById('app-version').textContent = version;
  } catch (error) {
    console.error('Failed to get app version:', error);
  }

  // Check if backend is ready
  checkBackendStatus();
  
  // Set up periodic status checks
  setInterval(checkBackendStatus, 5000);
  setInterval(checkSyncStatus, 10000);
}

async function checkBackendStatus() {
  try {
    const response = await fetch('http://localhost:8000/health');
    if (response.ok) {
      statusIndicator.classList.add('online');
      statusText.textContent = 'Backend Online';
    } else {
      statusIndicator.classList.remove('online');
      statusText.textContent = 'Backend Error';
    }
  } catch (error) {
    statusIndicator.classList.remove('online');
    statusText.textContent = 'Backend Offline';
  }
}

async function checkSyncStatus() {
  try {
    const response = await fetch('http://localhost:8000/api/sync/status');
    if (response.ok) {
      const data = await response.json();
      const isSyncing = data.syncing;
      
      if (isSyncing) {
        syncIndicator.className = 'sync-indicator syncing';
        syncText.textContent = 'Syncing...';
        wasSyncing = true;
      } else if (data.last_sync) {
        syncIndicator.className = 'sync-indicator synced';
        const time = new Date(data.last_sync).toLocaleTimeString();
        syncText.textContent = `Last sync: ${time}`;
        
        // Refresh iframe if sync just completed
        if (wasSyncing) {
          console.log('Sync completed, refreshing iframe');
          if (appFrame.src) {
            appFrame.src = appFrame.src;
          }
          wasSyncing = false;
        }
      } else {
        syncIndicator.className = 'sync-indicator';
        syncText.textContent = 'Not synced';
        wasSyncing = false;
      }
    }
  } catch (error) {
    syncIndicator.className = 'sync-indicator error';
    syncText.textContent = 'Sync error';
    wasSyncing = false;
  }
}

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Remove active class from all items
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    // Add active class to clicked item
    item.classList.add('active');
    
    // Navigate to section
    const section = item.dataset.section;
    const url = `http://localhost:8000/${section}`;
    appFrame.src = url;
    
    // Reset sync state on navigation
    wasSyncing = false;
  });
});

// Function to refresh current iframe content
function refreshIframe() {
  if (appFrame.src) {
    console.log('Refreshing iframe');
    appFrame.src = appFrame.src;
  }
}

// Restart Python backend
restartButton.addEventListener('click', async () => {
  try {
    restartButton.disabled = true;
    restartButton.textContent = 'Restarting...';
    
    await window.electronAPI.restartPython();
    
    // Wait for backend to restart
    setTimeout(() => {
      checkBackendStatus();
      restartButton.disabled = false;
      restartButton.textContent = 'Restart Backend';
    }, 3000);
  } catch (error) {
    console.error('Failed to restart Python:', error);
    restartButton.disabled = false;
    restartButton.textContent = 'Restart Backend';
  }
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
