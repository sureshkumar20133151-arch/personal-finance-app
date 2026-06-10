const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const PROTOCOL = 'budget-tracker';
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

const gotTheLock = app.requestSingleInstanceLock();
let mainWindow = null;

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Handle deep link (budget-tracker://...)
    const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (url && mainWindow) {
      mainWindow.webContents.executeJavaScript(`if(window.handleElectronDeepLink) window.handleElectronDeepLink("${url}");`);
    }
  });

  app.whenReady().then(() => {
    // Set app to run at startup
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath("exe")
    });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Let Vercel app know it's running inside Electron
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript('window.isElectronApp = true;');
  });

  mainWindow.loadURL('https://personal-finance-app-mauve.vercel.app');

  // Intercept window.open or target="_blank"
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open all external links in system browser
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
