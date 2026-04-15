const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Sistemdeki yazıcıları listele
  getPrinters: () => ipcRenderer.invoke('printers:list'),

  // Sessiz yazdır (print dialog yok)
  printReceipt: (html, printerName, paperWidth) =>
    ipcRenderer.invoke('print:receipt', { html, printerName, paperWidth }),

  // Electron ortamında olup olmadığını kontrol et
  isElectron: true,
})
