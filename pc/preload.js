const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  load: (s) => ipcRenderer.sendSync('load', s),
  save: (s, json) => ipcRenderer.send('save', s, json),
  exportData: (json, s) => ipcRenderer.invoke('export', json, s),
  importData: () => ipcRenderer.invoke('import'),
  openFolder: () => ipcRenderer.invoke('openFolder'),
  print: () => ipcRenderer.invoke('print'),
  updateInfo: () => ipcRenderer.invoke('update-info'),
  updateCheck: (u) => ipcRenderer.invoke('update-check', u),
  updateApply: (u) => ipcRenderer.invoke('update-apply', u),
  updateReset: () => ipcRenderer.invoke('update-reset')
});
