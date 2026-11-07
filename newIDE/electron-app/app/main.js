// Main process of the Webvelop desktop application.
//
// Webvelop is fully independent: all its data (settings, browser storage,
// caches, autosaves, logs, previews, exports and default projects folder) is
// stored in its own data folder, never shared with any other application:
// - development (not packaged): <repository>/.webvelop-data
// - packaged app: a "webvelop-data" folder next to the executable if it
//   exists (portable mode), otherwise <AppData>/Webvelop
// - or the folder given in the WEBVELOP_DATA_DIR environment variable.
const electron = require('electron');
const path = require('path');
const fs = require('fs');
const minimist = require('minimist');
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = electron;
const {
  buildElectronMenuFromDeclarativeTemplate,
  buildPlaceholderMainMenu,
} = require('./MainMenu');

const isDev = !app.isPackaged;
const PROJECT_FILE_EXTENSION = '.webvelop';

// ---------------------------------------------------------------------------
// Data folder (must be configured before the app is ready).
// ---------------------------------------------------------------------------
const resolveDataDir = () => {
  if (process.env.WEBVELOP_DATA_DIR) return path.resolve(process.env.WEBVELOP_DATA_DIR);
  if (isDev) return path.resolve(__dirname, '..', '..', '..', '.webvelop-data');
  // Portable executable (no installation): data next to the .exe.
  if (process.env.PORTABLE_EXECUTABLE_DIR)
    return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'webvelop-data');
  const portableDir = path.join(path.dirname(process.execPath), 'webvelop-data');
  if (fs.existsSync(portableDir)) return portableDir;
  return path.join(app.getPath('appData'), 'Webvelop');
};

const dataDir = resolveDataDir();
const webvelopPaths = {
  dataDir,
  projectsDir: path.join(dataDir, 'projects'),
  exportsDir: path.join(dataDir, 'exports'),
  previewDir: path.join(dataDir, 'preview'),
  logsDir: path.join(dataDir, 'logs'),
};
Object.values(webvelopPaths).forEach(folder => fs.mkdirSync(folder, { recursive: true }));
fs.mkdirSync(path.join(dataDir, 'autosaves'), { recursive: true });

app.setName('Webvelop');
app.setPath('userData', path.join(dataDir, 'electron'));
app.setPath('sessionData', path.join(dataDir, 'electron'));
app.setPath('logs', webvelopPaths.logsDir);
app.setPath('crashDumps', path.join(dataDir, 'crash-dumps'));
if (process.platform === 'win32') app.setAppUserModelId('com.webvelop.app');

// ---------------------------------------------------------------------------
// Logs (in the data folder of Webvelop).
// ---------------------------------------------------------------------------
const logFile = path.join(webvelopPaths.logsDir, 'main.log');
const log = (...values) => {
  const line = `[${new Date().toISOString()}] ${values
    .map(value => (value instanceof Error ? value.stack : typeof value === 'string' ? value : JSON.stringify(value)))
    .join(' ')}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch (error) {}
  if (isDev) process.stdout.write(line);
};
process.on('uncaughtException', error => log('Uncaught exception:', error));

const args = minimist(process.argv.slice(isDev ? 2 : 1));
global.args = args;
global.webvelopPaths = webvelopPaths;
log(`Webvelop ${app.getVersion()} starting (data folder: ${dataDir}, development: ${isDev}).`);

require('@electron/remote/main').initialize();

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------
const developmentServerUrl = process.env.WEBVELOP_DEV_SERVER_URL || 'http://localhost:3077';
let mainWindow = null;

const getProjectFileFromArgs = argv =>
  argv.find(argument => typeof argument === 'string' && argument.toLowerCase().endsWith(PROJECT_FILE_EXTENSION));

const createMainWindow = () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 560,
    title: 'Webvelop',
    show: false,
    icon: path.join(__dirname, 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#25252e', symbolColor: '#ffffff', height: 38 },
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#25252e',
    webPreferences: {
      // Local files (assets of the websites) are read by the editor.
      webSecurity: false,
      nodeIntegration: true,
      contextIsolation: false,
      spellcheck: true,
    },
  });
  require('@electron/remote/main').enable(window.webContents);
  window.once('ready-to-show', () => {
    window.maximize();
    window.show();
  });

  if (isDev) {
    window.loadURL(developmentServerUrl);
    if (args['dev-tools']) window.webContents.openDevTools();
  } else {
    window.loadFile(path.join(__dirname, 'www', 'index.html'));
    if (args['dev-tools']) window.webContents.openDevTools();
  }

  // Links opened by the editor (target=_blank) go to the default browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:|^file:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? url.startsWith(developmentServerUrl) : url.startsWith('file:');
    if (!allowed) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // The editor prevents closing when the website has unsaved changes: ask.
  window.webContents.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(window, {
      type: 'question',
      buttons: ['Close without saving', 'Cancel'],
      title: 'Unsaved changes',
      message: 'The website has unsaved changes.',
      detail: 'If you close Webvelop now, the changes since the last save will be lost.',
      defaultId: 1,
      cancelId: 1,
    });
    if (choice === 0) event.preventDefault();
  });

  window.webContents.on('render-process-gone', (event, details) => log('Renderer process gone:', details));
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });
  return window;
};

// Only one instance: opening a website from the file explorer focuses Webvelop.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    const projectFile = getProjectFileFromArgs(commandLine);
    if (projectFile) {
      mainWindow.webContents.send('webvelop-main-menu', {
        action: 'open-recent',
        args: { fileMetadata: { fileIdentifier: projectFile }, storageProviderName: 'LocalFile' },
      });
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(buildPlaceholderMainMenu());
    mainWindow = createMainWindow();

    // The menu is described by the editor (see MainFrame/MainMenu.js).
    ipcMain.on('set-main-menu', (event, template) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) return;
      Menu.setApplicationMenu(buildElectronMenuFromDeclarativeTemplate(window, template));
    });

    // Colors of the title bar, following the theme of the editor.
    ipcMain.handle('titlebar-set-overlay-options', async (event, overlayOptions) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) return;
      if (window.setTitleBarOverlay) window.setTitleBarOverlay({ ...overlayOptions, height: 38 });
      if (window.setBackgroundColor) window.setBackgroundColor(overlayOptions.color);
    });

    ipcMain.handle('window-maximize-toggle', async event => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) return;
      if (window.isMaximized()) window.unmaximize();
      else window.maximize();
    });

    app.on('activate', () => {
      if (!mainWindow) mainWindow = createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    log('All windows closed, quitting.');
    app.quit();
  });
}
