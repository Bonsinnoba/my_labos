const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  restartPython: () => ipcRenderer.invoke('restart-python'),
  onPythonLog: (callback) => ipcRenderer.on('python-log', callback),
  
  // API fetch function that uses IPC to bypass CORS restrictions
  apiFetch: async (url, options = {}) => {
    try {
      const response = await ipcRenderer.invoke('api-call', url, options);
      
      // Create a mock Response object that mimics the fetch API
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers),
        json: async () => JSON.parse(response.body),
        text: async () => response.body,
        clone: function() { return this; }
      };
    } catch (error) {
      console.error('API fetch error:', error);
      throw error;
    }
  },
  
  // Dedicated file upload function
  uploadFile: async (formDataFields) => {
    try {
      const response = await ipcRenderer.invoke('upload-file', formDataFields);
      
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        json: async () => JSON.parse(response.body),
        text: async () => response.body
      };
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }
});
