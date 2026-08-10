const { app, BrowserWindow, ipcMain, globalShortcut, desktopCapturer } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 660,
    minWidth: 720,
    minHeight: 520,
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
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Default to Stealth Mode on launch
  setStealthAffinity(true);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Applies Windows WDA_EXCLUDEFROMCAPTURE affinity so window is invisible to Zoom/Teams/Meet/Discord
 */
function setStealthAffinity(enable = true) {
  if (!mainWindow) return;

  // First attempt Electron native content protection
  try {
    mainWindow.setContentProtection(enable);
  } catch (err) {
    console.warn('Native content protection fallback warning:', err.message);
  }

  // Windows-specific Win32 API display affinity call (0x02 = WDA_EXCLUDEFROMCAPTURE, 0x00 = WDA_NONE)
  if (process.platform === 'win32') {
    try {
      const handle = mainWindow.getNativeWindowHandle();
      const hwnd = handle.readInt32LE(0);
      const val = enable ? 2 : 0;
      
      const psScript = `[reflection.assembly]::LoadWithPartialName("System.Windows.Forms") | Out-Null; $type = Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32Native { [DllImport("user32.dll")] public static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint affinity); }' -PassThru; [Win32Native]::SetWindowDisplayAffinity([IntPtr]${hwnd}, ${val})`;

      exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, (err) => {
        if (!err) {
          console.log(`[Stealth Engine] Display affinity set to ${enable ? 'INVISIBLE (0x02)' : 'VISIBLE (0x00)'}`);
        }
      });
    } catch (e) {
      console.error('[Stealth Engine] Affinity error:', e);
    }
  }
}

app.whenReady().then(() => {
  createWindow();

  // Register Global Keybinds (Matching Cluely specifications)
  // Ctrl + \ : Hide/Show Intruely Overlay
  globalShortcut.register('CommandOrControl+\\', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Ctrl + Shift + \ : Start/Stop Session
  globalShortcut.register('CommandOrControl+Shift+\\', () => {
    if (mainWindow) mainWindow.webContents.send('toggle-session-hotkey');
  });

  // Ctrl + Enter : Instant Screen Vision Question Solver
  globalShortcut.register('CommandOrControl+Return', () => {
    if (mainWindow) mainWindow.webContents.send('trigger-screen-capture');
  });

  // Window Position Adjustment (Ctrl + Arrows)
  globalShortcut.register('CommandOrControl+Up', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x, Math.max(0, y - 40));
    }
  });

  globalShortcut.register('CommandOrControl+Down', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x, y + 40);
    }
  });

  globalShortcut.register('CommandOrControl+Left', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(Math.max(0, x - 40), y);
    }
  });

  globalShortcut.register('CommandOrControl+Right', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x + 40, y);
    }
  });

  // Response Panel Scroll (Ctrl + Shift + Arrows)
  globalShortcut.register('CommandOrControl+Shift+Up', () => {
    if (mainWindow) mainWindow.webContents.send('scroll-window', -160);
  });

  globalShortcut.register('CommandOrControl+Shift+Down', () => {
    if (mainWindow) mainWindow.webContents.send('scroll-window', 160);
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

// IPC Handler Registrations
ipcMain.handle('get-screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      dataUrl: s.thumbnail.toDataURL()
    }));
  } catch (err) {
    console.error('Desktop capturer error:', err);
    return [];
  }
});

ipcMain.handle('toggle-stealth', (event, enable) => {
  setStealthAffinity(enable);
  return enable;
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close();
});

