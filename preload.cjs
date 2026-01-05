const { contextBridge } = require('electron');

/**
 * Preload Script
 * This script runs in a privileged context and exposes safe APIs to the renderer process.
 * It acts as a secure bridge between Electron's Node.js environment and the web app.
 */

// Expose platform information to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Platform detection
    platform: {
        isElectron: true,
        isDesktop: true,
        isMobile: false,
        os: process.platform, // 'win32', 'darwin', 'linux'
        version: process.versions.electron
    },

    // App information
    app: {
        name: 'Moneta',
        version: require('./package.json').version
    }

    // Future: Add IPC communication methods here if needed
    // Example:
    // sendMessage: (channel, data) => ipcRenderer.send(channel, data),
    // onMessage: (channel, callback) => ipcRenderer.on(channel, callback)
});

console.log('Preload script loaded - Electron API exposed');
