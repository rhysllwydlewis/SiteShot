const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('siteshot', {
  runAudit: data => ipcRenderer.invoke('run-audit', data),
  discoverPages: data => ipcRenderer.invoke('discover-pages', data),
  stopAudit: () => ipcRenderer.invoke('stop-audit'),
  openPath: targetPath => ipcRenderer.invoke('open-path', targetPath),
  openExternalFile: targetPath => ipcRenderer.invoke('open-external-file', targetPath),
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  exportOutputZip: outDir => ipcRenderer.invoke('export-output-zip', outDir),
  getVersion: () => ipcRenderer.invoke('get-version'),
  getStore: () => ipcRenderer.invoke('get-store'),
  saveProject: project => ipcRenderer.invoke('save-project', project),
  saveTemplate: template => ipcRenderer.invoke('save-template', template),
  deleteStoreItem: (kind, id) => ipcRenderer.invoke('delete-store-item', kind, id),
  deleteRun: (id, deleteFiles) => ipcRenderer.invoke('delete-run', id, deleteFiles),
  bulkDeleteRuns: (ids, deleteFiles) => ipcRenderer.invoke('bulk-delete-runs', ids, deleteFiles),
  saveSettings: settings => ipcRenderer.invoke('save-settings', settings),
  windowAction: action => ipcRenderer.invoke('window-action', action),
  openHelpDocs: () => ipcRenderer.invoke('open-help-docs'),
  onLog: callback => ipcRenderer.on('audit-log', (_event, text) => callback(text)),
  onComplete: callback => ipcRenderer.on('audit-complete', (_event, payload) => callback(payload)),
  onSwitchView: callback => ipcRenderer.on('switch-view', (_event, view) => callback(view)),
  onStoreUpdated: callback => ipcRenderer.on('store-updated', (_event, store) => callback(store))
});
