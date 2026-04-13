const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pytutor', {
  detectFile:     ()              => ipcRenderer.invoke('detect-file'),
  readFile:       (path)          => ipcRenderer.invoke('read-file', path),
  runPython:      (path)          => ipcRenderer.invoke('run-python', path),

  startPython:    (path)          => ipcRenderer.invoke('start-python', path),
  sendPythonInput:(data)          => ipcRenderer.send('python-input', data),
  stopPython:     ()              => ipcRenderer.send('stop-python'),
  onPythonOutput: (callback)      => ipcRenderer.on('python-output', (_, data) => callback(data)),
  onPythonExit:   (callback)      => ipcRenderer.on('python-exit', (_, code) => callback(code)),

  openFileDialog: ()              => ipcRenderer.invoke('open-file-dialog'),
  chat:           (history, model)=> ipcRenderer.invoke('chat', history, model),
  aiEdit:         (opts)          => ipcRenderer.invoke('ai-edit', opts),
  minimize:       ()              => ipcRenderer.send('window-minimize'),
  maximize:       ()              => ipcRenderer.send('window-maximize'),
  close:          ()              => ipcRenderer.send('window-close'),
  toggleTop:      ()              => ipcRenderer.invoke('window-toggle-top'),
  toggleServer:   ()              => ipcRenderer.invoke('toggle-server'),
  checkServer:    ()              => ipcRenderer.invoke('check-server'),
  onServerStatus: (callback)      => ipcRenderer.on('server-status-changed', (_, status) => callback(status)),

  // Settings
  getSettings:    ()              => ipcRenderer.invoke('get-settings'),
  saveSettings:   (settings)      => ipcRenderer.invoke('save-settings', settings),
  fetchModels:    (provider)      => ipcRenderer.invoke('fetch-models', provider),
});
