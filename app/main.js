'use strict';

// imports
import electron from 'electron';
import handleStartupEvent from './windows-launcher';
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
require('electron-debug');

let mainWindow = null;

if (!handleStartupEvent()) {
  if (app.makeSingleInstance((commandLine, workingDirectory) => {
      // someone tried to run a second instance, we should focus our window
      if (windowManager != null) {
        windowManager.focusFirstWindow()
      }
      return true;
    })) {
    app.quit();
    }
   else {
    app.on('ready', createWindow);
    app.on('window-all-closed', function () {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', function () {
      if (mainWindow === null) {
        createWindow();
      }
    });
  }
}

function createWindow () {
  mainWindow = new BrowserWindow({
    "width": 480,
    "height": 640,
    'resizable': false,
  });
  mainWindow.setMenu(null);
  mainWindow.loadURL('file://' + __dirname + '/index.html');
  mainWindow.on('closed', function() {
    mainWindow = null;
  });
}
