const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  openImages: () => ipcRenderer.invoke('dialog:openImages'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readDroppedPaths: (paths) => ipcRenderer.invoke('fs:readDroppedPaths', paths),
  getPathForFile: (file) => {
    try {
      return webUtils ? webUtils.getPathForFile(file) : (file.path || '');
    } catch {
      return file.path || '';
    }
  },
  getSystemFonts: () => ipcRenderer.invoke('system:getFonts'),
  saveExportImage: (opts) => ipcRenderer.invoke('export:saveImage', opts),
  showItemInFolder: (fp) => ipcRenderer.invoke('shell:showItem', fp),
  loadCustomTemplates: () => ipcRenderer.invoke('templates:loadCustom'),
  saveCustomTemplates: (list) => ipcRenderer.invoke('templates:saveCustom', list),
  exportTemplateFile: (opts) => ipcRenderer.invoke('templates:exportFile', opts),
  importTemplateFile: () => ipcRenderer.invoke('templates:importFile'),
  loadCustomStickers: () => ipcRenderer.invoke('stickers:loadCustom'),
  saveCustomStickers: (list) => ipcRenderer.invoke('stickers:saveCustom', list),
  openStickerImages: () => ipcRenderer.invoke('dialog:openStickerImages'),
  saveProject: (opts) => ipcRenderer.invoke('project:save', opts),
  openProject: () => ipcRenderer.invoke('project:open')
});
