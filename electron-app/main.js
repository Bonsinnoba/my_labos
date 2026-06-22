const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let pythonProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Allow loading local files
    },
    icon: path.join(__dirname, 'resources', 'icon.png')
  });

  // Hide default menu bar
  Menu.setApplicationMenu(null);

  // Load the local web UI HTML file
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startPythonBackend() {
  const pythonPath = getPythonExecutable();
  const scriptPath = path.join(__dirname, '..', 'start_web_app.py');
  
  console.log('Starting Python backend...');
  console.log('Python path:', pythonPath);
  console.log('Script path:', scriptPath);

  pythonProcess = spawn(pythonPath, [scriptPath], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python stdout: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
  });
}

function getPythonExecutable() {
  // Check for bundled Python executable first
  const bundledPython = process.platform === 'win32' 
    ? path.join(__dirname, 'python-dist', 'lab-backend.exe')
    : path.join(__dirname, 'python-dist', 'lab-backend');
  
  if (fs.existsSync(bundledPython)) {
    console.log('Using bundled Python executable:', bundledPython);
    return bundledPython;
  }
  
  // Fall back to system Python
  const systemPython = process.platform === 'win32' ? 'python' : 'python3';
  console.log('Using system Python:', systemPython);
  return systemPython;
}

app.whenReady().then(() => {
  createWindow();
  startPythonBackend();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Kill Python process when app closes
    if (pythonProcess) {
      pythonProcess.kill();
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  // Kill Python process before app quits
  if (pythonProcess) {
    pythonProcess.kill();
  }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('restart-python', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  startPythonBackend();
  return { success: true };
});

// API call handler to bypass CORS
ipcMain.handle('api-call', async (event, url, options) => {
  try {
    // Prepend base URL for relative URLs (use IPv4 to avoid IPv6 issues)
    const fullUrl = url.startsWith('http') ? url : `http://127.0.0.1:8000${url}`;
    const response = await fetch(fullUrl, options);
    
    // Convert response to a format that can be sent over IPC
    const body = await response.text();
    const headers = {};
    response.headers.forEach((value, name) => {
      headers[name] = value;
    });
    
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: headers,
      body: body
    };
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
});
