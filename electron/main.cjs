const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Spoof User-Agent to bypass Google's "unsecure browser" block for OAuth
  const customUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  app.userAgentFallback = customUserAgent;
  mainWindow.webContents.userAgent = customUserAgent;

  // Ensure any popup windows also get the spoofed User-Agent
  mainWindow.webContents.on('did-create-window', (childWindow) => {
    childWindow.webContents.userAgent = customUserAgent;
  });

  // Load the live Vercel App. This ensures the .exe always has the latest version automatically!
  mainWindow.loadURL('https://personal-finance-app-mauve.vercel.app');

  // Handle external popups (important for Google Login)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Let Firebase Google Auth popups open inside the app
    if (url.includes('accounts.google.com') || url.includes('firebase')) {
      return { 
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        }
      };
    }
    // Open other links in the user's default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
