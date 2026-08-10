const { app, BrowserWindow, ipcMain, globalShortcut, desktopCapturer } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 950,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  applyStealthProtection(true);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function applyStealthProtection(enable = true) {
  if (process.platform === 'win32' && mainWindow) {
    try {
      const handle = mainWindow.getNativeWindowHandle();
      const hwnd = handle.readInt32LE(0);
      const affinityVal = enable ? 2 : 0;
      
      // Clean PowerShell snippet without multiline string parsing errors
      const psCommand = 'Add-Type -TypeDefinition "using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\\"user32.dll\\")] public static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint affinity); }"; [Win32]::SetWindowDisplayAffinity([IntPtr]' + hwnd + ', ' + affinityVal + ')';

      exec(`powershell -Command "${psCommand}"`, (err) => {
        if (err) {
          console.log('Stealth status update:', err.message);
        } else {
          console.log(`Stealth Window affinity updated: ${enable ? 'INVISIBLE' : 'VISIBLE'}`);
        }
      });
    } catch (e) {
      console.error('Error applying stealth protection:', e);
    }
  }
}

app.whenReady().then(() => {
  createWindow();

  // Register Global Hotkeys matching Cluely specs
  // Ctrl + \ : Toggle Intruely Visibility
  globalShortcut.register('CommandOrControl+\\', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });

  // Ctrl + Shift + \ : Start or stop Intruely session
  globalShortcut.register('CommandOrControl+Shift+\\', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-session-hotkey');
    }
  });

  // Ctrl + Enter : Ask Intruely about screen/audio
  globalShortcut.register('CommandOrControl+Return', () => {
    if (mainWindow) {
      mainWindow.webContents.send('trigger-screen-capture');
    }
  });

  // Window Position Shortcuts (Matching Cluely Keybinds)
  // Ctrl + Up : Move window position up
  globalShortcut.register('CommandOrControl+Up', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x, Math.max(0, y - 50));
    }
  });

  // Ctrl + Down : Move window position down
  globalShortcut.register('CommandOrControl+Down', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x, y + 50);
    }
  });

  // Ctrl + Left : Move window position left
  globalShortcut.register('CommandOrControl+Left', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(Math.max(0, x - 50), y);
    }
  });

  // Ctrl + Right : Move window position right
  globalShortcut.register('CommandOrControl+Right', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x + 50, y);
    }
  });

  // Scroll Response Window Shortcuts
  // Ctrl + Shift + Up : Scroll response window up
  globalShortcut.register('CommandOrControl+Shift+Up', () => {
    if (mainWindow) {
      mainWindow.webContents.send('scroll-window', -150);
    }
  });

  // Ctrl + Shift + Down : Scroll response window down
  globalShortcut.register('CommandOrControl+Shift+Down', () => {
    if (mainWindow) {
      mainWindow.webContents.send('scroll-window', 150);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('get-screen-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  });
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    dataUrl: s.thumbnail.toDataURL()
  }));
});

ipcMain.handle('toggle-stealth', (event, enable) => {
  applyStealthProtection(enable);
  return enable;
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close();
});
