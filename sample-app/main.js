/**
 * Electron JSON Settings Store
 * Sample App - Main process
 * 
 * based on electron-quick-start
 * https://github.com/electron/electron-quick-start
 */

// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const { ElectronJSONSettingsStoreMain } = require('../dist/index');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let settingsWindow;

app.allowRendererProcessReuse = true; // just to disable console deprecated warning

const schema = {
  size: { type: 'number', positive: true, integer: true, default: 25, min: 10, max: 40 },
  darkMode: { type: 'boolean', default: false },
  name: { type: 'string', default: 'World' }
};

const config = new ElectronJSONSettingsStoreMain(schema, { filePath: __dirname, validateFile: true, defaultOnFailValidation: false, watchFile: false, saveBeforeQuit: true });


function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: true
    }
  });

  // And load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
    settingsWindow = null;
    app.quit();
  });


  // Open the DevTools.
  mainWindow.webContents.openDevTools({ mode: "bottom" });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    setTimeout(() => {
      createSettingsWindow();
    }, 1000);
  });
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    height: 280,
    parent: mainWindow,
    darkTheme: true,
    modal: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload_2.js'),
      devTools: true
    }
  });

  settingsWindow.loadFile('index_2.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  settingsWindow.webContents.openDevTools({ mode: "right" });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  config.init()
    .then(() => {
      createWindow();
    })
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
});

ipcMain.on('open-settings-window', ()=> {
  if (!settingsWindow) {
    createSettingsWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

setTimeout(() => {
  console.log(config.getDefault('name'));

  // test invalid setting
  console.log(config.validate('size', 55));

  // change setting
  config.set('name', 'you');
}, 2000);